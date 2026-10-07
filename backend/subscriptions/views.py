import json
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from auths.views import _is_admin
from stores.models import Store, SubscriptionPlan
from .models import SubscriptionInvoice, SubscriptionStatus


def _current_month():
    now = timezone.localtime()
    return timezone.datetime(now.year, now.month, 1).date()


def _parse_month(raw):
    value = str(raw or "").strip()
    if not value:
        return _current_month()
    value = value[:10]
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y/%m/%d", "%Y/%m"):
        try:
            return datetime.strptime(value, fmt).date().replace(day=1)
        except ValueError:
            continue
    return None


def unpaid_store_ids_for_month(period_month=None):
    """Monthly-plan store ids billed for the month but NOT paid -> products hidden.
    Free-plan stores are never hidden, even if an old invoice is left unpaid."""
    month = period_month or _current_month()
    return list(
        SubscriptionInvoice.objects.filter(
            period_month=month,
            status=SubscriptionStatus.UNPAID,
            store__subscription_plan=SubscriptionPlan.MONTHLY,
        ).values_list("store_id", flat=True)
    )


def store_plan_payload(store):
    """The store's subscription plan, as shown to admins and the vendor."""
    return {
        "plan": store.subscription_plan,
        "plan_label": store.get_subscription_plan_display(),
        "monthly_fee": str(store.monthly_fee) if store.monthly_fee is not None else "",
        "plan_updated_at": store.plan_updated_at.isoformat() if store.plan_updated_at else None,
    }


def _owner_name(user):
    if not user:
        return ""
    return user.first_name or getattr(user, "phone_number", "") or user.email or ""


def _month_payload(period_month):
    invoices = {
        inv.store_id: inv
        for inv in SubscriptionInvoice.objects.filter(period_month=period_month)
    }
    stores = Store.objects.select_related("owner").order_by("name")

    rows = []
    total_expected = Decimal("0")
    total_paid = Decimal("0")
    total_pending = Decimal("0")
    for store in stores:
        listing_count = store.listings.count()
        inv = invoices.get(store.id)
        plan = store_plan_payload(store)
        if inv is None:
            if store.monthly_fee is not None:
                prev_amount = str(store.monthly_fee)
            else:
                last = (
                    store.subscription_invoices.order_by("-period_month").first()
                )
                prev_amount = str(last.amount) if last else ""
            rows.append({
                "store_id": str(store.id),
                "store": store.name,
                "owner": _owner_name(store.owner),
                "listings": listing_count,
                "status": "not_billed",
                "amount": prev_amount,
                "invoice_id": "",
                "paid_at": None,
                **plan,
            })
            continue

        amount = Decimal(inv.amount)
        total_expected += amount
        if inv.status == SubscriptionStatus.PAID:
            total_paid += amount
        else:
            total_pending += amount
        rows.append({
            "store_id": str(store.id),
            "store": store.name,
            "owner": _owner_name(store.owner),
            "listings": listing_count,
            "status": inv.status,
            "amount": str(inv.amount),
            "invoice_id": str(inv.pk),
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            **plan,
        })

    return {
        "month": period_month.isoformat(),
        "summary": {
            "expected": str(total_expected),
            "paid": str(total_paid),
            "pending": str(total_pending),
            "stores": len(rows),
            "not_billed": sum(1 for r in rows if r["status"] == "not_billed"),
            "free_stores": sum(1 for r in rows if r["plan"] == SubscriptionPlan.FREE),
            "monthly_stores": sum(1 for r in rows if r["plan"] == SubscriptionPlan.MONTHLY),
        },
        "stores": rows,
    }


@csrf_exempt
def admin_revenue_view(request):
    """Admin: GET a per-store monthly snapshot; POST to save the month's amounts."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)

    if request.method == "GET":
        month = _parse_month(request.GET.get("month"))
        if month is None:
            return JsonResponse({"error": "Invalid month. Use e.g. 2026-09."}, status=400)
        return JsonResponse(_month_payload(month))

    if request.method == "POST":
        try:
            data = json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)

        month = _parse_month(data.get("month"))
        if month is None:
            return JsonResponse({"error": "Invalid month. Use e.g. 2026-09."}, status=400)

        entries = data.get("entries") or []
        if not isinstance(entries, list) or not entries:
            return JsonResponse({"error": "entries must be a non-empty list."}, status=400)

        if not all(isinstance(e, dict) for e in entries):
            return JsonResponse({"error": "Each entry must be an object."}, status=400)
        store_plans = {
            str(store_id): plan
            for store_id, plan in Store.objects.filter(
                id__in=[str(e.get("store_id") or "").strip() for e in entries]
            ).values_list("id", "subscription_plan")
        }
        payloads = []
        for entry in entries:
            store_id = str(entry.get("store_id") or "").strip()
            if store_id not in store_plans:
                return JsonResponse({"error": "Unknown store."}, status=400)
            if store_plans[store_id] == SubscriptionPlan.FREE:
                return JsonResponse(
                    {"error": "This store is on the Free plan. Switch it to Monthly before billing."},
                    status=400,
                )
            try:
                amount = Decimal(str(entry.get("amount") or "0"))
            except InvalidOperation:
                return JsonResponse({"error": "Invalid amount."}, status=400)
            if amount < 0:
                return JsonResponse({"error": "Amount cannot be negative."}, status=400)
            payloads.append((store_id, amount))

        with transaction.atomic():
            for store_id, amount in payloads:
                SubscriptionInvoice.objects.update_or_create(
                    store_id=store_id,
                    period_month=month,
                    defaults={"amount": amount},
                )

        return JsonResponse(_month_payload(month))

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def admin_store_plan_view(request, store_id):
    """Admin: PATCH {"plan": "free"|"monthly", "monthly_fee"?} to set a store's plan."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    store = Store.objects.filter(pk=store_id).first()
    if store is None:
        return JsonResponse({"error": "Store not found."}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    plan = (data.get("plan") or "").strip()
    if plan not in {SubscriptionPlan.FREE, SubscriptionPlan.MONTHLY}:
        return JsonResponse({"error": "Plan must be 'free' or 'monthly'."}, status=400)

    if plan == SubscriptionPlan.MONTHLY:
        try:
            fee = Decimal(str(data.get("monthly_fee") or ""))
        except InvalidOperation:
            return JsonResponse({"error": "Enter the monthly fee."}, status=400)
        if fee <= 0:
            return JsonResponse({"error": "Monthly fee must be greater than zero."}, status=400)
        store.monthly_fee = fee

    store.subscription_plan = plan
    store.plan_updated_at = timezone.now()
    store.updated_by = request.user
    store.save(update_fields=[
        "subscription_plan", "monthly_fee", "plan_updated_at", "updated_by", "updated_at",
    ])

    return JsonResponse({
        "success": True,
        "store_id": str(store.pk),
        "store": store.name,
        **store_plan_payload(store),
    })


@csrf_exempt
def admin_revenue_invoice_view(request, invoice_id):
    """Admin: PATCH {"status": "paid"|"unpaid"} to settle or reopen a store's monthly invoice."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    invoice = SubscriptionInvoice.objects.select_related("store").filter(pk=invoice_id).first()
    if invoice is None:
        return JsonResponse({"error": "Invoice not found."}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    new_status = (data.get("status") or "").strip()
    if new_status not in {SubscriptionStatus.PAID, SubscriptionStatus.UNPAID}:
        return JsonResponse({"error": "Status must be 'paid' or 'unpaid'."}, status=400)

    if new_status == SubscriptionStatus.PAID:
        invoice.status = SubscriptionStatus.PAID
        invoice.paid_at = timezone.now()
        invoice.paid_by = request.user
        invoice.updated_by = request.user
    else:
        invoice.status = SubscriptionStatus.UNPAID
        invoice.paid_at = None
        invoice.updated_by = request.user
    invoice.save(update_fields=["status", "paid_at", "paid_by", "updated_by", "updated_at"])

    return JsonResponse({
        "success": True,
        "invoice": {
            "invoice_id": str(invoice.pk),
            "store_id": str(invoice.store_id),
            "store": invoice.store.name,
            "month": invoice.period_month.isoformat(),
            "amount": str(invoice.amount),
            "status": invoice.status,
            "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
        },
    })