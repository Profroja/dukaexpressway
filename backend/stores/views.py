import json

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from auths.views import _is_admin
from catalog.models import ListingType
from .models import Store, StoreStatus


def _admin_store_payload(store):
    listings = list(store.listings.all())
    product_count = sum(
        1 for l in listings if l.listing_type == ListingType.PRODUCT
    )
    service_count = sum(
        1 for l in listings if l.listing_type == ListingType.SERVICE
    )
    owner = store.owner
    return {
        "id": str(store.pk),
        "name": store.name,
        "slug": store.slug,
        "status": store.status,
        "category": store.category.name if store.category_id else "",
        "additional_categories": [c.name for c in store.categories.all()],
        "rating_avg": str(store.rating_avg),
        "rating_count": store.rating_count,
        "created_at": store.created_at.isoformat() if store.created_at else None,
        "owner": {
            "name": owner.get_full_name() or owner.get_username(),
            "phone_number": owner.phone_number,
            "email": owner.email or "",
        },
        "listing_types": {
            "products": product_count,
            "services": service_count,
            "total": len(listings),
        },
        "listings": [
            {
                "id": str(l.pk),
                "title": l.title,
                "listing_type": l.listing_type,
                "is_active": l.is_active,
            }
            for l in listings
        ],
    }


@csrf_exempt
def admin_stores_view(request):
    """Admin: list every store and what it provides."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    stores = (
        Store.objects.select_related("owner", "category")
        .prefetch_related("categories", "listings")
        .order_by("-created_at")
    )

    items = [_admin_store_payload(store) for store in stores]
    total_products = sum(s["listing_types"]["products"] for s in items)
    total_services = sum(s["listing_types"]["services"] for s in items)
    return JsonResponse(
        {
            "success": True,
            "stores": items,
            "counts": {
                "total": len(items),
                "approved": sum(
                    1 for s in items if s["status"] == StoreStatus.APPROVED
                ),
                "pending": sum(
                    1 for s in items if s["status"] == StoreStatus.PENDING
                ),
                "suspended": sum(
                    1 for s in items if s["status"] == StoreStatus.SUSPENDED
                ),
                "rejected": sum(
                    1 for s in items if s["status"] == StoreStatus.REJECTED
                ),
                "products": total_products,
                "services": total_services,
            },
        }
    )


@csrf_exempt
def admin_store_update_view(request, store_id):
    """Admin: activate (approve) or deactivate (suspend) a store."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    status = data.get("status")
    if status not in (StoreStatus.APPROVED, StoreStatus.SUSPENDED):
        return JsonResponse(
            {"error": "Invalid status. Use 'approved' or 'suspended'."},
            status=400,
        )

    try:
        store = (
            Store.objects.select_related("owner", "category")
            .prefetch_related("categories", "listings")
            .get(pk=store_id)
        )
    except Store.DoesNotExist:
        return JsonResponse({"error": "Store not found."}, status=404)

    store.status = status
    store.updated_by = request.user
    if status == StoreStatus.APPROVED and store.approved_at is None:
        store.approved_at = timezone.now()
        store.approved_by = request.user
    store.save()

    return JsonResponse(
        {"success": True, "store": _admin_store_payload(store)}
    )