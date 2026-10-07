"""Monthly revenue for Mo Expressway.

How the money is counted for a month:

* Received from customers - customer orders CLOSED in that month, using the
  exact amount the admin recorded as paid when closing.
* Paid to vendors - purchase orders the store confirmed as paid in that month
  (the amount the store says it received, else the agreed total).
* Order profit - for the orders closed that month: what the customer paid
  minus what we paid the stores for those same orders.
* Delivered orders not yet closed are reported separately: the money is not
  counted until the admin records exactly what the customer paid.
* Subscription income - monthly subscription invoices for that month that are
  marked paid.
* Total revenue = order profit + subscription income.
"""

from datetime import date
from decimal import Decimal

from django.db.models import Prefetch
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from auths.views import _is_admin
from subscriptions.models import SubscriptionInvoice, SubscriptionStatus
from subscriptions.views import _parse_month

from .models import (
    PurchaseOrderPaymentStatus,
    PurchaseOrderStatus,
    QuickOrder,
    QuickOrderStatus,
    StorePurchaseOrder,
)

ZERO = Decimal("0")


def _month_range(month):
    """Timezone-aware [start, end) for the calendar month."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(timezone.datetime(month.year, month.month, 1), tz)
    next_month = date(month.year + (month.month == 12), month.month % 12 + 1, 1)
    end = timezone.make_aware(timezone.datetime(next_month.year, next_month.month, 1), tz)
    return start, end


def _paid_amount(po):
    return po.amount_received if po.amount_received is not None else po.total_amount


def _iso(value):
    return value.isoformat() if value else None


def finance_summary(month):
    start, end = _month_range(month)

    closed = (
        QuickOrder.objects.filter(
            status=QuickOrderStatus.CLOSED, closed_at__gte=start, closed_at__lt=end
        )
        .select_related("listing")
        .prefetch_related(
            Prefetch(
                "purchase_orders",
                queryset=StorePurchaseOrder.objects.filter(
                    status=PurchaseOrderStatus.PICKED_UP
                ).select_related("store"),
                to_attr="collected_pos",
            )
        )
        .order_by("-closed_at")
    )
    order_rows = []
    received_from_customers = ZERO
    cost_of_delivered = ZERO
    for order in closed:
        cost = sum((_paid_amount(po) for po in order.collected_pos), ZERO)
        paid = order.amount_paid if order.amount_paid is not None else order.total_amount
        received_from_customers += paid
        cost_of_delivered += cost
        order_rows.append({
            "id": str(order.pk),
            "delivered_at": _iso(order.delivered_at),
            "closed_at": _iso(order.closed_at),
            "product": f"{order.quantity}x {order.listing.title}",
            "listing_type": order.listing.listing_type,
            "customer_name": order.customer_name,
            "stores": sorted({po.store.name for po in order.collected_pos}),
            "customer_paid": str(paid),
            "agreed_price": str(order.total_amount),
            "paid_to_store": str(cost),
            "profit": str(paid - cost),
        })

    # Delivered but not closed: money expected, not yet recorded (any month).
    awaiting = QuickOrder.objects.filter(status=QuickOrderStatus.DELIVERED)
    awaiting_rows = [
        {
            "id": str(o.pk),
            "delivered_at": _iso(o.delivered_at),
            "product": f"{o.quantity}x {o.listing.title}",
            "customer_name": o.customer_name,
            "expected": str(o.total_amount),
        }
        for o in awaiting.select_related("listing").order_by("delivered_at")
    ]

    vendor_payments = (
        StorePurchaseOrder.objects.filter(
            payment_status=PurchaseOrderPaymentStatus.PAID, paid_at__gte=start, paid_at__lt=end
        )
        .select_related("store")
        .order_by("-paid_at")
    )
    payment_rows = []
    paid_to_vendors = ZERO
    for po in vendor_payments:
        amount = _paid_amount(po)
        paid_to_vendors += amount
        payment_rows.append({
            "po_number": po.po_number,
            "store": po.store.name,
            "item": f"{po.quantity}x {po.listing_title_snapshot}",
            "paid_at": _iso(po.paid_at),
            "agreed": str(po.total_amount),
            "amount": str(amount),
            "status": po.status,
        })

    invoices = (
        SubscriptionInvoice.objects.filter(period_month=month, status=SubscriptionStatus.PAID)
        .select_related("store")
        .order_by("store__name")
    )
    subscription_rows = []
    subscription_income = ZERO
    for inv in invoices:
        subscription_income += inv.amount
        subscription_rows.append({
            "store": inv.store.name,
            "amount": str(inv.amount),
            "paid_at": _iso(inv.paid_at),
        })
    subscriptions_unpaid = SubscriptionInvoice.objects.filter(
        period_month=month, status=SubscriptionStatus.UNPAID
    ).count()

    order_profit = received_from_customers - cost_of_delivered
    return {
        "month": month.isoformat(),
        "summary": {
            "received_from_customers": str(received_from_customers),
            "paid_to_vendors": str(paid_to_vendors),
            "cost_of_delivered_orders": str(cost_of_delivered),
            "order_profit": str(order_profit),
            "subscription_income": str(subscription_income),
            "total_revenue": str(order_profit + subscription_income),
            "delivered_orders": len(order_rows),  # closed with payment recorded
            "closed_orders": len(order_rows),
            "awaiting_close": len(awaiting_rows),
            "awaiting_close_expected": str(
                sum((Decimal(r["expected"]) for r in awaiting_rows), ZERO)
            ),
            "vendor_payments": len(payment_rows),
            "paid_subscriptions": len(subscription_rows),
            "unpaid_subscriptions": subscriptions_unpaid,
        },
        "orders": order_rows,
        "awaiting_close": awaiting_rows,
        "vendor_payments": payment_rows,
        "subscriptions": subscription_rows,
    }


def _previous_months(month, count):
    """`count` first-of-month dates ending with `month`, oldest first."""
    months = []
    year, mon = month.year, month.month
    for _ in range(count):
        months.append(date(year, mon, 1))
        year, mon = (year - 1, 12) if mon == 1 else (year, mon - 1)
    return list(reversed(months))


def dashboard_summary(month):
    """Everything the admin home page shows, from real data."""
    from django.contrib.auth import get_user_model
    from django.db.models import Count, Sum
    from django.db.models.functions import TruncDate

    from auths.models import UserRole
    from catalog.models import Listing, ListingType
    from stores.models import Store, StoreStatus, SubscriptionPlan

    start, end = _month_range(month)
    finance = finance_summary(month)["summary"]

    # --- people & catalogue -------------------------------------------------
    User = get_user_model()
    stores = Store.objects.all()
    store_counts = dict(stores.values_list("status").annotate(n=Count("id")))
    listings = Listing.objects.filter(is_active=True)

    # --- orders ------------------------------------------------------------
    orders_all = QuickOrder.objects.all()
    orders_month = orders_all.filter(created_at__gte=start, created_at__lt=end)
    status_counts = dict(orders_month.values_list("status").annotate(n=Count("id")))
    open_status_counts = dict(
        orders_all.exclude(status__in=[QuickOrderStatus.CLOSED, QuickOrderStatus.CANCELLED])
        .values_list("status")
        .annotate(n=Count("id"))
    )

    # Money we still owe stores: orders they accepted (price agreed) but have
    # not yet confirmed as paid.
    owed = StorePurchaseOrder.objects.filter(
        status__in=[PurchaseOrderStatus.ACCEPTED, PurchaseOrderStatus.READY],
        payment_status=PurchaseOrderPaymentStatus.UNPAID,
    )
    owed_total = owed.aggregate(t=Sum("total_amount"))["t"] or ZERO

    cards = {
        "stores_total": stores.count(),
        "stores_approved": store_counts.get(StoreStatus.APPROVED, 0),
        "stores_pending": store_counts.get(StoreStatus.PENDING, 0),
        "stores_free_plan": stores.filter(subscription_plan=SubscriptionPlan.FREE).count(),
        "stores_monthly_plan": stores.filter(subscription_plan=SubscriptionPlan.MONTHLY).count(),
        "customers": orders_all.values("customer_phone").distinct().count(),
        "customers_new_this_month": orders_month.exclude(
            customer_phone__in=orders_all.filter(created_at__lt=start).values("customer_phone")
        ).values("customer_phone").distinct().count(),
        "vendors": User.objects.filter(role=UserRole.VENDOR_OWNER, is_active=True).count(),
        "products": listings.filter(listing_type=ListingType.PRODUCT).count(),
        "services": listings.filter(listing_type=ListingType.SERVICE).count(),
        "orders_this_month": orders_month.count(),
        "orders_needing_action": sum(
            open_status_counts.get(s, 0)
            for s in (QuickOrderStatus.NEW, QuickOrderStatus.CONTACTED, QuickOrderStatus.CONFIRMED)
        ),
        "orders_at_stores": open_status_counts.get(QuickOrderStatus.SOURCING, 0),
        "orders_on_the_way": open_status_counts.get(QuickOrderStatus.PICKED_UP, 0),
        "orders_delivered_this_month": finance["closed_orders"],
        "orders_closed_this_month": finance["closed_orders"],
        "orders_awaiting_close": finance["awaiting_close"],
        "awaiting_close_expected": finance["awaiting_close_expected"],
        "orders_cancelled_this_month": status_counts.get(QuickOrderStatus.CANCELLED, 0),
        "owed_to_vendors": str(owed_total),
        "owed_to_vendors_count": owed.count(),
        **{k: finance[k] for k in (
            "total_revenue", "received_from_customers", "paid_to_vendors",
            "order_profit", "subscription_income", "unpaid_subscriptions",
        )},
    }

    # --- statistics --------------------------------------------------------
    monthly = []
    for m in _previous_months(month, 6):
        s = finance_summary(m)["summary"]
        monthly.append({
            "month": m.strftime("%Y-%m"),
            "label": m.strftime("%b %Y"),
            "total_revenue": float(s["total_revenue"]),
            "received_from_customers": float(s["received_from_customers"]),
            "paid_to_vendors": float(s["paid_to_vendors"]),
            "orders": QuickOrder.objects.filter(
                created_at__gte=_month_range(m)[0], created_at__lt=_month_range(m)[1]
            ).count(),
        })

    per_day = dict(
        orders_month.annotate(day=TruncDate("created_at"))
        .values_list("day")
        .annotate(n=Count("id"))
    )
    daily = []
    cursor = start.date()
    last = min(end, timezone.now() + timezone.timedelta(days=1)).date()
    while cursor < last and cursor < end.date():
        daily.append({"date": cursor.isoformat(), "label": str(cursor.day), "orders": per_day.get(cursor, 0)})
        cursor += timezone.timedelta(days=1)

    status_order = [
        QuickOrderStatus.NEW, QuickOrderStatus.CONTACTED, QuickOrderStatus.CONFIRMED,
        QuickOrderStatus.SOURCING, QuickOrderStatus.PICKED_UP, QuickOrderStatus.DELIVERED,
        QuickOrderStatus.CLOSED, QuickOrderStatus.CANCELLED,
    ]
    by_status = [
        {"status": s.value, "label": s.label, "orders": status_counts.get(s, 0)} for s in status_order
    ]

    top_stores = [
        {"store": row["store__name"], "amount": float(row["total"]), "orders": row["n"]}
        for row in StorePurchaseOrder.objects.filter(
            payment_status=PurchaseOrderPaymentStatus.PAID, paid_at__gte=start, paid_at__lt=end
        )
        .values("store__name")
        .annotate(total=Sum(Coalesce("amount_received", "total_amount")), n=Count("id"))
        .order_by("-total")[:5]
    ]

    return {
        "month": month.isoformat(),
        "cards": cards,
        "stats": {
            "monthly": monthly,
            "daily_orders": daily,
            "orders_by_status": by_status,
            "top_stores": top_stores,
        },
    }


@csrf_exempt
def admin_dashboard_view(request):
    """Admin: GET ?month=YYYY-MM - dashboard cards and statistics."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    month = _parse_month(request.GET.get("month"))
    if month is None:
        return JsonResponse({"error": "Invalid month. Use e.g. 2026-10."}, status=400)
    return JsonResponse(dashboard_summary(month))


@csrf_exempt
def admin_finance_view(request):
    """Admin: GET ?month=YYYY-MM - revenue, profit and cash flow for the month."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    month = _parse_month(request.GET.get("month"))
    if month is None:
        return JsonResponse({"error": "Invalid month. Use e.g. 2026-10."}, status=400)
    return JsonResponse(finance_summary(month))
