import json
import re
import uuid
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from catalog.models import Listing
from catalog.views import BLOCKED_STORE_STATUSES, purchasable_listings
from stores.models import Store, StoreStatus
from subscriptions.models import SubscriptionInvoice, SubscriptionStatus
from subscriptions.views import _current_month, store_plan_payload, unpaid_store_ids_for_month
from auths.views import _is_admin
from .models import (
    ACTIVE_PURCHASE_ORDER_STATUSES,
    PriceStatus,
    PurchaseOrderPaymentStatus,
    PurchaseOrderStatus,
    QuickOrder,
    QuickOrderStatus,
    StorePurchaseOrder,
)
from . import notifications
from .notifications import PLATFORM_BUYER_NAME


def _json_body(request):
    try:
        return json.loads(request.body or "{}"), None
    except json.JSONDecodeError:
        return None, JsonResponse({"error": "Invalid JSON body"}, status=400)


def _primary_image_url(listing):
    images = list(listing.images.all())
    primary = next((img for img in images if img.is_primary), None) or (
        images[0] if images else None
    )
    return primary.image_url if primary else ""


# ---------------------------------------------------------------------------
# Customer (public) endpoints
# ---------------------------------------------------------------------------

@csrf_exempt
def quick_order_view(request):
    """Receive a fast guest order: name + phone + listing + quantity.

    The order goes to the platform admins only - the store is not notified.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data, error = _json_body(request)
    if error:
        return error

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()
    listing_id = (data.get("listing_id") or "").strip()

    if not name:
        return JsonResponse({"error": "Please enter your name."}, status=400)
    if len(name) > 120:
        return JsonResponse({"error": "Name is too long."}, status=400)
    if len(address) > 255:
        return JsonResponse({"error": "Address is too long."}, status=400)

    digits = re.sub(r"\D", "", phone)
    if len(digits) < 9 or len(digits) > 15:
        return JsonResponse(
            {"error": "Please enter a valid mobile number."}, status=400
        )

    try:
        quantity = int(data.get("quantity") or 1)
    except (TypeError, ValueError):
        quantity = 0
    if quantity < 1 or quantity > 999:
        return JsonResponse({"error": "Enter a valid quantity."}, status=400)

    try:
        uuid.UUID(listing_id)
    except ValueError:
        return JsonResponse({"error": "Product not found."}, status=404)
    listing = purchasable_listings().filter(pk=listing_id).select_related("store").first()
    if listing is None:
        return JsonResponse({"error": "Product not found."}, status=404)

    unit_price = listing.price
    try:
        total = Decimal(str(unit_price)) * quantity
    except (InvalidOperation, TypeError):
        return JsonResponse({"error": "Could not calculate order total."}, status=400)

    order = QuickOrder.objects.create(
        listing=listing,
        store=listing.store,
        customer_name=name,
        customer_phone=phone,
        delivery_address=address,
        quantity=quantity,
        unit_price=unit_price,
        total_amount=total,
        currency=listing.currency,
        created_by=request.user if request.user.is_authenticated else None,
        updated_by=request.user if request.user.is_authenticated else None,
    )
    notifications.notify_admins_new_customer_order(order)

    return JsonResponse(
        {
            "ok": True,
            "order_id": str(order.pk),
            "total": str(order.total_amount),
            "currency": order.currency,
        },
        status=201,
    )


@csrf_exempt
def quick_order_status_view(request, order_id):
    """Public order tracking: GET status; POST {"status": "cancelled"} to cancel."""
    order = QuickOrder.objects.filter(pk=order_id).first()
    if order is None:
        return JsonResponse({"error": "Order not found."}, status=404)

    # Closing is internal bookkeeping; to the customer it is simply delivered.
    public_status = (
        QuickOrderStatus.DELIVERED if order.status == QuickOrderStatus.CLOSED else order.status
    )

    if request.method == "GET":
        return JsonResponse(
            {
                "order_id": str(order.pk),
                "status": public_status,
                "total": str(order.total_amount),
                "currency": order.currency,
            }
        )

    if request.method == "POST":
        data, error = _json_body(request)
        if error:
            return error
        # Customers can only cancel before we have started buying from a store.
        if data.get("status") == "cancelled" and order.status in (
            QuickOrderStatus.NEW,
            QuickOrderStatus.CONTACTED,
        ):
            order.status = QuickOrderStatus.CANCELLED
            order.save(update_fields=["status", "updated_at"])
            notifications.notify_admins_customer_cancelled(order)
            public_status = order.status
        return JsonResponse({"order_id": str(order.pk), "status": public_status})

    return JsonResponse({"error": "Method not allowed"}, status=405)


# ---------------------------------------------------------------------------
# Vendor endpoints - purchase orders only, never customer details
# ---------------------------------------------------------------------------

def _vendor_po_to_dict(po):
    """What a vendor is allowed to see about a purchase order."""
    return {
        "id": str(po.pk),
        "po_number": po.po_number,
        "buyer": PLATFORM_BUYER_NAME,
        "product_title": po.listing_title_snapshot,
        "product_image": _primary_image_url(po.listing),
        "listing_type": po.listing.listing_type,
        "quantity": po.quantity,
        "unit_price": str(po.unit_price),
        "total": str(po.total_amount),
        "currency": po.currency,
        "status": po.status,
        "listing_price": str(po.listing.price),
        "price_status": po.price_status,
        "vendor_quote": str(po.vendor_quote) if po.vendor_quote is not None else None,
        "vendor_quote_note": po.vendor_quote_note,
        "quoted_at": po.quoted_at.isoformat() if po.quoted_at else None,
        "payment_status": po.payment_status,
        "paid_at": po.paid_at.isoformat() if po.paid_at else None,
        "amount_received": str(po.amount_received) if po.amount_received is not None else None,
        "vendor_note": po.vendor_note,
        "created_at": po.created_at.isoformat() if po.created_at else None,
        "accepted_at": po.accepted_at.isoformat() if po.accepted_at else None,
        "ready_at": po.ready_at.isoformat() if po.ready_at else None,
        "picked_up_at": po.picked_up_at.isoformat() if po.picked_up_at else None,
    }


def _vendor_store(request):
    if not request.user.is_authenticated:
        return None, JsonResponse({"authenticated": False}, status=401)
    store = Store.objects.select_related("category").filter(owner=request.user).first()
    if store is None:
        return None, JsonResponse({"error": "No store linked to this account."}, status=400)
    return store, None


def vendor_dashboard_view(request):
    """Real summary and recent purchase-order data for the logged-in vendor."""
    store, error = _vendor_store(request)
    if error:
        return error
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    purchase_orders = StorePurchaseOrder.objects.filter(store=store)
    # Sales = purchase orders the store has confirmed it was paid for.
    completed_sales = purchase_orders.filter(
        payment_status=PurchaseOrderPaymentStatus.PAID
    ).exclude(
        status__in=[PurchaseOrderStatus.REJECTED, PurchaseOrderStatus.CANCELLED]
    ).aggregate(
        total=Sum(Coalesce("amount_received", "total_amount"))
    )["total"] or Decimal("0")
    recent = (
        purchase_orders.select_related("listing")
        .prefetch_related("listing__images")
        .order_by("-created_at")[:5]
    )
    plan = store_plan_payload(store)
    subscription_status = f"{plan['plan_label']} plan"

    current_month = _current_month()
    current_invoice = (
        SubscriptionInvoice.objects.filter(store=store, period_month=current_month).first()
    )
    history_invoices = (
        SubscriptionInvoice.objects.filter(store=store).order_by("-period_month")[:6]
    )
    subscription = {
        **plan,
        "month": current_month.isoformat(),
        "amount": str(current_invoice.amount) if current_invoice else "",
        "status": current_invoice.status if current_invoice else "not_billed",
        "invoice_id": str(current_invoice.pk) if current_invoice else "",
        "paid_at": current_invoice.paid_at.isoformat() if current_invoice and current_invoice.paid_at else None,
        "history": [
            {
                "month": inv.period_month.isoformat(),
                "amount": str(inv.amount),
                "status": inv.status,
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            }
            for inv in history_invoices
        ],
    }

    return JsonResponse({
        "store": {
            "name": store.name,
            "category": store.category.name if store.category_id else "",
        },
        "vendor_name": request.user.first_name or request.user.email,
        "summary": {
            "total_sales": str(completed_sales),
            "orders": purchase_orders.count(),
            "pending_orders": purchase_orders.filter(status=PurchaseOrderStatus.SENT).count(),
            "listings": store.listings.count(),
            "platform_subscription": subscription_status,
        },
        "subscription": subscription,
        "recent_orders": [_vendor_po_to_dict(po) for po in recent],
    })


# Status changes a vendor may make, keyed by the current status.
VENDOR_TRANSITIONS = {
    PurchaseOrderStatus.SENT: {PurchaseOrderStatus.ACCEPTED, PurchaseOrderStatus.REJECTED},
    PurchaseOrderStatus.ACCEPTED: {PurchaseOrderStatus.READY, PurchaseOrderStatus.REJECTED},
}


@csrf_exempt
def vendor_orders_view(request):
    """List and update the purchase orders Mo Expressway placed with this store."""
    store, error = _vendor_store(request)
    if error:
        return error

    if request.method == "GET":
        purchase_orders = (
            StorePurchaseOrder.objects.filter(store=store)
            .select_related("listing")
            .prefetch_related("listing__images")
            .order_by("-created_at")
        )
        return JsonResponse({"orders": [_vendor_po_to_dict(po) for po in purchase_orders]})

    if request.method in ("PATCH", "POST", "PUT"):
        data, error = _json_body(request)
        if error:
            return error

        order_id = (data.get("order_id") or "").strip()
        new_status = (data.get("status") or "").strip()
        payment_status = (data.get("payment_status") or "").strip()
        note = (data.get("note") or "").strip()
        quote_raw = data.get("quote")

        try:
            uuid.UUID(order_id)
        except ValueError:
            return JsonResponse({"error": "Order not found."}, status=404)

        with transaction.atomic():
            po = (
                StorePurchaseOrder.objects.select_for_update()
                .filter(pk=order_id, store=store)
                .first()
            )
            if po is None:
                return JsonResponse({"error": "Order not found."}, status=404)

            # The store proposes its own total price (e.g. a service quote, or a
            # counter-offer). Mo Expressway then accepts it or counter-offers.
            if quote_raw not in (None, ""):
                if po.status != PurchaseOrderStatus.SENT:
                    return JsonResponse(
                        {"error": "You can only propose a price before accepting the order."},
                        status=400,
                    )
                try:
                    quote = Decimal(str(quote_raw).replace(",", ""))
                except InvalidOperation:
                    return JsonResponse({"error": "Enter your price."}, status=400)
                if quote <= 0 or quote > Decimal("9999999999"):
                    return JsonResponse({"error": "Enter a valid price."}, status=400)
                po.vendor_quote = quote
                po.vendor_quote_note = note[:1000]
                po.quoted_at = timezone.now()
                po.price_status = PriceStatus.VENDOR_PROPOSED
                po.updated_by = request.user
                po.save(update_fields=[
                    "vendor_quote", "vendor_quote_note", "quoted_at", "price_status",
                    "updated_by", "updated_at",
                ])
                notifications.notify_admins_vendor_quote(po)
                po = (
                    StorePurchaseOrder.objects.select_related("listing")
                    .prefetch_related("listing__images")
                    .get(pk=po.pk)
                )
                return JsonResponse({"order": _vendor_po_to_dict(po)})

            # The store confirms it has received Mo Expressway's payment.
            if payment_status:
                if payment_status != PurchaseOrderPaymentStatus.PAID:
                    return JsonResponse({"error": "Invalid payment status."}, status=400)
                if po.status not in (PurchaseOrderStatus.ACCEPTED, PurchaseOrderStatus.READY):
                    return JsonResponse(
                        {"error": "Accept the order before marking it as paid."}, status=400
                    )
                if po.payment_status == PurchaseOrderPaymentStatus.PAID:
                    return JsonResponse({"error": "This order is already marked as paid."}, status=400)
                try:
                    amount_received = Decimal(str(data.get("amount_received") or "").replace(",", ""))
                except InvalidOperation:
                    return JsonResponse({"error": "Enter the amount you received."}, status=400)
                if amount_received <= 0 or amount_received > Decimal("9999999999"):
                    return JsonResponse({"error": "Enter a valid amount received."}, status=400)
                po.payment_status = PurchaseOrderPaymentStatus.PAID
                po.paid_at = timezone.now()
                po.amount_received = amount_received
                po.updated_by = request.user
                po.save(update_fields=[
                    "payment_status", "paid_at", "amount_received", "updated_by", "updated_at",
                ])
                notifications.notify_admins_vendor_update(po, "paid")
                po = (
                    StorePurchaseOrder.objects.select_related("listing")
                    .prefetch_related("listing__images")
                    .get(pk=po.pk)
                )
                return JsonResponse({"order": _vendor_po_to_dict(po)})

            if (
                new_status == PurchaseOrderStatus.REJECTED
                and po.payment_status == PurchaseOrderPaymentStatus.PAID
            ):
                return JsonResponse(
                    {"error": "This order is already paid. Contact Mo Expressway to cancel it."},
                    status=400,
                )

            allowed = VENDOR_TRANSITIONS.get(po.status, set())
            if new_status not in allowed:
                return JsonResponse(
                    {"error": f"Cannot change this order from '{po.status}' to '{new_status}'."},
                    status=400,
                )
            if new_status == PurchaseOrderStatus.ACCEPTED and po.price_status in (
                PriceStatus.AWAITING_QUOTE,
                PriceStatus.VENDOR_PROPOSED,
            ):
                return JsonResponse(
                    {"error": "The price is not agreed yet. Send your price or wait for Mo Expressway's reply."},
                    status=400,
                )

            now = timezone.now()
            po.status = new_status
            po.updated_by = request.user
            update_fields = ["status", "updated_by", "updated_at"]
            if note:
                po.vendor_note = note[:1000]
                update_fields.append("vendor_note")
            if new_status == PurchaseOrderStatus.ACCEPTED:
                # Accepting the order means accepting the offered price.
                po.accepted_at = now
                po.price_status = PriceStatus.AGREED
                update_fields += ["accepted_at", "price_status"]
            elif new_status == PurchaseOrderStatus.READY:
                po.ready_at = now
                update_fields.append("ready_at")
            po.save(update_fields=update_fields)
            notifications.notify_admins_vendor_update(po, new_status)

            if new_status == PurchaseOrderStatus.REJECTED:
                _reopen_customer_order_if_unsourced(po.customer_order, request.user)

        po = (
            StorePurchaseOrder.objects.select_related("listing")
            .prefetch_related("listing__images")
            .get(pk=po.pk)
        )
        return JsonResponse({"order": _vendor_po_to_dict(po)})

    return JsonResponse({"error": "Method not allowed"}, status=405)


# ---------------------------------------------------------------------------
# Admin endpoints - customer orders and sourcing from stores
# ---------------------------------------------------------------------------

def _reopen_customer_order_if_unsourced(order, user):
    """When a store rejects/cancels and no other store is working on it,
    put the customer order back in the admin's queue as 'confirmed'."""
    if order.status != QuickOrderStatus.SOURCING:
        return
    still_active = order.purchase_orders.filter(
        status__in=ACTIVE_PURCHASE_ORDER_STATUSES
    ).exists()
    if not still_active:
        order.status = QuickOrderStatus.CONFIRMED
        order.updated_by = user
        order.save(update_fields=["status", "updated_by", "updated_at"])


def _admin_po_to_dict(po):
    payload = _vendor_po_to_dict(po)
    payload["store"] = po.store.name
    payload["store_id"] = str(po.store_id)
    payload["store_phone"] = po.store.owner.phone_number if po.store.owner_id else ""
    payload["listing_id"] = str(po.listing_id)
    payload["admin_note"] = po.admin_note
    return payload


def _admin_order_to_dict(order):
    purchase_orders = sorted(
        order.purchase_orders.all(), key=lambda po: po.created_at, reverse=True
    )
    # Only purchase orders with a price on the table count as cost; one still
    # waiting for the store's quote has no price yet.
    priced = [
        po
        for po in purchase_orders
        if (po.status in ACTIVE_PURCHASE_ORDER_STATUSES or po.status == PurchaseOrderStatus.PICKED_UP)
        and po.price_status != PriceStatus.AWAITING_QUOTE
    ]
    cost = sum((po.total_amount for po in priced), Decimal("0"))
    has_cost = bool(priced)
    received = order.amount_paid if order.amount_paid is not None else order.total_amount
    return {
        "id": str(order.pk),
        "product_title": order.listing.title,
        "product_image": _primary_image_url(order.listing),
        "listing_id": str(order.listing_id),
        "listing_type": order.listing.listing_type,
        "listed_store": order.store.name if order.store_id else "",
        "listed_store_id": str(order.store_id) if order.store_id else "",
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "delivery_address": order.delivery_address,
        "admin_note": order.admin_note,
        "quantity": order.quantity,
        "unit_price": str(order.unit_price),
        "total": str(order.total_amount),
        "price_on_request": order.total_amount == 0,
        "currency": order.currency,
        "status": order.status,
        "amount_paid": str(order.amount_paid) if order.amount_paid is not None else None,
        "cost": str(cost) if has_cost else None,
        # Once closed, margin uses what the customer actually paid.
        "margin": str(received - cost) if has_cost else None,
        "purchase_orders": [_admin_po_to_dict(po) for po in purchase_orders],
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "closed_at": order.closed_at.isoformat() if order.closed_at else None,
    }


def _admin_order_queryset():
    return QuickOrder.objects.select_related("store", "listing").prefetch_related(
        "listing__images",
        "purchase_orders__store__owner",
        "purchase_orders__listing__images",
    )


@csrf_exempt
def admin_orders_view(request):
    """Admin: list every customer order with its store purchase orders."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    orders = _admin_order_queryset().order_by("-created_at")
    items = [_admin_order_to_dict(order) for order in orders]
    counts = {"total": len(items)}
    for choice in QuickOrderStatus:
        counts[choice.value] = sum(1 for o in items if o["status"] == choice.value)
    return JsonResponse({"success": True, "orders": items, "counts": counts})


# Customer-order statuses the admin can set directly. Sourcing and picked_up
# are driven by purchase orders.
ADMIN_SETTABLE_STATUSES = {
    QuickOrderStatus.NEW,
    QuickOrderStatus.CONTACTED,
    QuickOrderStatus.CONFIRMED,
    QuickOrderStatus.DELIVERED,
    QuickOrderStatus.CLOSED,
    QuickOrderStatus.CANCELLED,
}


@csrf_exempt
def admin_order_detail_view(request, order_id):
    """Admin: PATCH status / address / note, DELETE to permanently remove."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)

    if request.method == "DELETE":
        # Permanently removes the customer order and every purchase order made
        # for it. Stores still working on one are told it was cancelled.
        with transaction.atomic():
            order = QuickOrder.objects.select_for_update().filter(pk=order_id).first()
            if order is None:
                return JsonResponse({"error": "Order not found."}, status=404)
            purchase_orders = list(order.purchase_orders.select_related("store__owner"))
            for po in purchase_orders:
                if po.status in ACTIVE_PURCHASE_ORDER_STATUSES:
                    notifications.notify_vendor_purchase_order_cancelled(po)
            order.purchase_orders.all().delete()
            order.delete()
        return JsonResponse({"success": True, "deleted_purchase_orders": len(purchase_orders)})

    if request.method == "PATCH":
        data, error = _json_body(request)
        if error:
            return error

        with transaction.atomic():
            order = QuickOrder.objects.select_for_update().filter(pk=order_id).first()
            if order is None:
                return JsonResponse({"error": "Order not found."}, status=404)

            update_fields = ["updated_by", "updated_at"]

            if "delivery_address" in data:
                order.delivery_address = (data.get("delivery_address") or "").strip()[:255]
                update_fields.append("delivery_address")
            if "admin_note" in data:
                order.admin_note = (data.get("admin_note") or "").strip()
                update_fields.append("admin_note")

            # The price agreed with the customer (services are often priced
            # only after the job size is known). Fixed once the order is closed.
            if "customer_total" in data:
                if order.status in (QuickOrderStatus.CLOSED, QuickOrderStatus.CANCELLED):
                    return JsonResponse({"error": "This order is already closed."}, status=400)
                try:
                    customer_total = Decimal(str(data.get("customer_total")).replace(",", ""))
                except InvalidOperation:
                    return JsonResponse({"error": "Enter a valid price."}, status=400)
                if customer_total < 0 or customer_total > Decimal("9999999999"):
                    return JsonResponse({"error": "Enter a valid price."}, status=400)
                order.total_amount = customer_total
                order.unit_price = (customer_total / order.quantity).quantize(Decimal("0.01"))
                update_fields += ["total_amount", "unit_price"]

            # Exactly what the customer paid: required to close the order, and
            # correctable on a closed order so revenue stays true.
            amount_paid = None
            if "amount_paid" in data:
                try:
                    amount_paid = Decimal(str(data.get("amount_paid")).replace(",", ""))
                except InvalidOperation:
                    return JsonResponse({"error": "Enter the amount the customer paid."}, status=400)
                if amount_paid <= 0 or amount_paid > Decimal("9999999999"):
                    return JsonResponse({"error": "Enter the amount the customer paid."}, status=400)

            new_status = (data.get("status") or "").strip()
            if amount_paid is not None and not new_status:
                if order.status != QuickOrderStatus.CLOSED:
                    return JsonResponse(
                        {"error": "Record the payment by closing the order."}, status=400
                    )
                order.amount_paid = amount_paid
                update_fields.append("amount_paid")

            if new_status:
                if new_status not in ADMIN_SETTABLE_STATUSES:
                    return JsonResponse({"error": "Invalid status."}, status=400)
                if order.status in (QuickOrderStatus.CLOSED, QuickOrderStatus.CANCELLED):
                    return JsonResponse({"error": "This order is already closed."}, status=400)
                if order.status == QuickOrderStatus.DELIVERED and new_status != QuickOrderStatus.CLOSED:
                    return JsonResponse(
                        {"error": "A delivered order can only be closed with the amount the customer paid."},
                        status=400,
                    )
                if new_status == QuickOrderStatus.DELIVERED and order.status != QuickOrderStatus.PICKED_UP:
                    return JsonResponse(
                        {"error": "Mark the store purchase order as picked up before delivering."},
                        status=400,
                    )
                if new_status == QuickOrderStatus.CLOSED:
                    if order.status != QuickOrderStatus.DELIVERED:
                        return JsonResponse(
                            {"error": "Only delivered orders can be closed."}, status=400
                        )
                    if amount_paid is None:
                        return JsonResponse(
                            {"error": "Enter exactly what the customer paid to close the order."},
                            status=400,
                        )
                    order.amount_paid = amount_paid
                    order.closed_at = timezone.now()
                    update_fields += ["amount_paid", "closed_at"]
                if new_status == QuickOrderStatus.CANCELLED:
                    active_pos = list(
                        order.purchase_orders.select_related("store__owner").filter(
                            status__in=ACTIVE_PURCHASE_ORDER_STATUSES
                        )
                    )
                    for po in active_pos:
                        po.status = PurchaseOrderStatus.CANCELLED
                        po.updated_by = request.user
                        po.save(update_fields=["status", "updated_by", "updated_at"])
                        notifications.notify_vendor_purchase_order_cancelled(po)
                elif new_status in (
                    QuickOrderStatus.NEW,
                    QuickOrderStatus.CONTACTED,
                    QuickOrderStatus.CONFIRMED,
                ) and order.purchase_orders.filter(
                    status__in=ACTIVE_PURCHASE_ORDER_STATUSES
                ).exists():
                    return JsonResponse(
                        {"error": "A store is already working on this order. Cancel its purchase order first."},
                        status=400,
                    )
                order.status = new_status
                update_fields.append("status")
                if new_status == QuickOrderStatus.DELIVERED:
                    order.delivered_at = timezone.now()
                    update_fields.append("delivered_at")

            order.updated_by = request.user
            order.save(update_fields=update_fields)

        order = _admin_order_queryset().get(pk=order.pk)
        return JsonResponse({"success": True, "order": _admin_order_to_dict(order)})

    return JsonResponse({"error": "Method not allowed"}, status=405)


def _search_terms(text):
    return [w for w in re.findall(r"[\w']+", (text or "").lower()) if len(w) >= 3]


@csrf_exempt
def admin_order_sourcing_view(request, order_id):
    """Admin: stores/listings that can fulfil this customer order.

    GET ?q=... optionally narrows by product title or store name. Results are
    ranked: the exact listing the customer ordered, then title-word matches,
    then same-category listings; cheaper first within a rank.
    """
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    order = QuickOrder.objects.select_related("listing").filter(pk=order_id).first()
    if order is None:
        return JsonResponse({"error": "Order not found."}, status=404)

    # Same rule as the public catalog, so the customer's own choice is always
    # buyable unless its store was blocked after the order was placed.
    base = (
        purchasable_listings()
        .select_related("store", "store__region", "category")
        .prefetch_related("images")
    )

    q = (request.GET.get("q") or "").strip()
    if q:
        candidates = base.filter(Q(title__icontains=q) | Q(store__name__icontains=q))
    else:
        terms = _search_terms(order.listing.title)
        match = Q(pk=order.listing_id) | Q(category_id=order.listing.category_id)
        for term in terms:
            match |= Q(title__icontains=term)
        candidates = base.filter(match)

    terms = _search_terms(q or order.listing.title)
    results = []
    for item in candidates[:200]:
        title = item.title.lower()
        score = 0
        if item.pk == order.listing_id:
            score += 100
        score += 10 * sum(1 for t in terms if t in title)
        if item.category_id == order.listing.category_id:
            score += 5
        in_stock = item.stock_quantity is None or item.stock_quantity >= order.quantity
        results.append({
            "listing_id": str(item.pk),
            "title": item.title,
            "image_url": _primary_image_url(item),
            "store": item.store.name,
            "store_id": str(item.store_id),
            "region": item.store.region.name if item.store.region_id else "",
            "price": str(item.price),
            "currency": item.currency,
            "stock_quantity": item.stock_quantity,
            "in_stock": in_stock,
            "is_original": item.pk == order.listing_id,
            "store_status": item.store.status,
            "_score": score,
        })

    results.sort(key=lambda r: (-r["_score"], not r["in_stock"], Decimal(r["price"])))
    for r in results:
        r.pop("_score")

    # Tell the admin why the customer's choice is missing, instead of silently
    # offering other stores.
    original_unavailable = None
    if not q and not any(r["is_original"] for r in results):
        original = Listing.objects.select_related("store").get(pk=order.listing_id)
        if not original.is_active:
            reason = "The store marked this listing as unavailable."
        elif original.store.status in BLOCKED_STORE_STATUSES:
            reason = f"The store is {original.store.get_status_display().lower()}."
        else:
            reason = "The store has not paid this month's subscription."
        original_unavailable = {"store": original.store.name, "reason": reason}

    return JsonResponse({
        "success": True,
        "options": results[:50],
        "original_unavailable": original_unavailable,
    })


def _new_po_number():
    return f"PO-{timezone.now():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"


@csrf_exempt
def admin_create_purchase_order_view(request, order_id):
    """Admin: buy the goods for a customer order from a chosen store.

    POST {"listing_id", "quantity"?, "unit_price"?, "admin_note"?}
    """
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data, error = _json_body(request)
    if error:
        return error

    with transaction.atomic():
        order = QuickOrder.objects.select_for_update().filter(pk=order_id).first()
        if order is None:
            return JsonResponse({"error": "Order not found."}, status=404)
        if order.status in (
            QuickOrderStatus.CANCELLED,
            QuickOrderStatus.DELIVERED,
            QuickOrderStatus.PICKED_UP,
        ):
            return JsonResponse({"error": "This order can no longer be sourced."}, status=400)
        if order.purchase_orders.filter(status__in=ACTIVE_PURCHASE_ORDER_STATUSES).exists():
            return JsonResponse(
                {"error": "A store is already working on this order. Cancel that purchase order first."},
                status=400,
            )

        listing_id = (data.get("listing_id") or "").strip()
        try:
            uuid.UUID(listing_id)
        except ValueError:
            return JsonResponse({"error": "Choose a store product."}, status=400)
        listing = purchasable_listings().filter(pk=listing_id).select_related("store").first()
        if listing is None:
            return JsonResponse({"error": "That store product is not available."}, status=404)

        try:
            quantity = int(data.get("quantity") or order.quantity)
        except (TypeError, ValueError):
            quantity = 0
        if quantity < 1 or quantity > 999:
            return JsonResponse({"error": "Enter a valid quantity."}, status=400)

        # Either offer a price, or ask the store to quote (common for services
        # whose price depends on the size of the job).
        request_quote = data.get("request_quote") is True
        if request_quote:
            unit_price = Decimal("0")
            price_status = PriceStatus.AWAITING_QUOTE
        else:
            raw_price = data.get("unit_price")
            try:
                unit_price = (
                    Decimal(str(raw_price).replace(",", "")) if raw_price not in (None, "") else listing.price
                )
            except (InvalidOperation, TypeError):
                return JsonResponse({"error": "Enter a valid unit price."}, status=400)
            if unit_price <= 0:
                return JsonResponse(
                    {"error": "Enter a price, or ask the store to send its quote."}, status=400
                )
            price_status = PriceStatus.OFFERED

        po = StorePurchaseOrder.objects.create(
            po_number=_new_po_number(),
            customer_order=order,
            store=listing.store,
            listing=listing,
            listing_title_snapshot=listing.title,
            quantity=quantity,
            unit_price=unit_price,
            total_amount=unit_price * quantity,
            price_status=price_status,
            currency=listing.currency,
            admin_note=(data.get("admin_note") or "").strip(),
            created_by=request.user,
            updated_by=request.user,
        )

        order.status = QuickOrderStatus.SOURCING
        order.updated_by = request.user
        order.save(update_fields=["status", "updated_by", "updated_at"])
        notifications.notify_vendor_new_purchase_order(po)

    order = _admin_order_queryset().get(pk=order.pk)
    return JsonResponse(
        {"success": True, "purchase_order_id": str(po.pk), "order": _admin_order_to_dict(order)},
        status=201,
    )


@csrf_exempt
def admin_purchase_order_detail_view(request, po_id):
    """Admin: PATCH a purchase order.

    {"status": "picked_up" | "cancelled"} moves it on,
    {"unit_price": "45000"} offers a (new) price - the store must accept it again,
    {"accept_quote": true} agrees to the price the store proposed.
    Price changes are only possible before the store confirms payment.
    """
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data, error = _json_body(request)
    if error:
        return error
    new_status = (data.get("status") or "").strip()

    with transaction.atomic():
        po = (
            StorePurchaseOrder.objects.select_for_update()
            .select_related("customer_order", "store__owner")
            .filter(pk=po_id)
            .first()
        )
        if po is None:
            return JsonResponse({"error": "Purchase order not found."}, status=404)
        if po.status not in ACTIVE_PURCHASE_ORDER_STATUSES:
            return JsonResponse({"error": "This purchase order is already closed."}, status=400)

        order = po.customer_order
        price_change = not new_status and ("unit_price" in data or data.get("accept_quote") is True)
        if price_change and po.payment_status == PurchaseOrderPaymentStatus.PAID:
            return JsonResponse(
                {"error": "The store already confirmed payment; the price can no longer change."},
                status=400,
            )

        if data.get("accept_quote") is True and not new_status:
            if po.price_status != PriceStatus.VENDOR_PROPOSED or po.vendor_quote is None:
                return JsonResponse({"error": "There is no store quote to accept."}, status=400)
            # The store already committed to this price by quoting it, so the
            # order is accepted on its behalf.
            po.total_amount = po.vendor_quote
            po.unit_price = (po.vendor_quote / po.quantity).quantize(Decimal("0.01"))
            po.price_status = PriceStatus.AGREED
            po.status = PurchaseOrderStatus.ACCEPTED
            po.accepted_at = timezone.now()
            po.updated_by = request.user
            po.save(update_fields=[
                "total_amount", "unit_price", "price_status", "status", "accepted_at",
                "updated_by", "updated_at",
            ])
            notifications.notify_vendor_quote_accepted(po)
        elif "unit_price" in data and not new_status:
            try:
                unit_price = Decimal(str(data.get("unit_price")).replace(",", ""))
            except InvalidOperation:
                return JsonResponse({"error": "Enter a valid unit price."}, status=400)
            if unit_price <= 0:
                return JsonResponse({"error": "Enter a valid unit price."}, status=400)
            old_total = po.total_amount
            po.unit_price = unit_price
            po.total_amount = unit_price * po.quantity
            # A new offer goes back to the store to accept.
            po.price_status = PriceStatus.OFFERED
            update_fields = ["unit_price", "total_amount", "price_status", "updated_by", "updated_at"]
            if po.status != PurchaseOrderStatus.SENT:
                po.status = PurchaseOrderStatus.SENT
                update_fields.append("status")
            po.updated_by = request.user
            po.save(update_fields=update_fields)
            notifications.notify_vendor_price_changed(po, old_total)
        elif new_status == PurchaseOrderStatus.PICKED_UP:
            if po.status == PurchaseOrderStatus.SENT:
                return JsonResponse(
                    {"error": "The store has not accepted this order yet."}, status=400
                )
            if po.payment_status != PurchaseOrderPaymentStatus.PAID:
                return JsonResponse(
                    {"error": "The store must mark this order as paid before it can be picked up."},
                    status=400,
                )
            po.status = PurchaseOrderStatus.PICKED_UP
            po.picked_up_at = timezone.now()
            po.updated_by = request.user
            po.save(update_fields=["status", "picked_up_at", "updated_by", "updated_at"])
            notifications.notify_vendor_picked_up(po)
            if order.status != QuickOrderStatus.CANCELLED:
                order.status = QuickOrderStatus.PICKED_UP
                order.updated_by = request.user
                order.save(update_fields=["status", "updated_by", "updated_at"])
        elif new_status == PurchaseOrderStatus.CANCELLED:
            po.status = PurchaseOrderStatus.CANCELLED
            po.updated_by = request.user
            po.save(update_fields=["status", "updated_by", "updated_at"])
            notifications.notify_vendor_purchase_order_cancelled(po)
            _reopen_customer_order_if_unsourced(order, request.user)
        else:
            return JsonResponse({"error": "Invalid status."}, status=400)

    order = _admin_order_queryset().get(pk=order.pk)
    return JsonResponse({"success": True, "order": _admin_order_to_dict(order)})
