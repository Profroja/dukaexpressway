import json
import uuid
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from auths.views import _is_admin
from stores.models import Store, StoreCategory, StoreStatus, listing_type_for_category
from subscriptions.views import unpaid_store_ids_for_month
from .models import Listing, ListingImage, ListingType, ProductCategory


# Stores whose listings must never be sold.
BLOCKED_STORE_STATUSES = (StoreStatus.SUSPENDED, StoreStatus.REJECTED)


def purchasable_listings():
    """Listings customers can order - and therefore Mo Expressway can buy.

    The single rule shared by the public catalog, order placement and admin
    sourcing, so a customer can never order something the admin cannot then
    buy from the same store.
    """
    return (
        Listing.objects.filter(is_active=True)
        .exclude(store__status__in=BLOCKED_STORE_STATUSES)
        .exclude(store_id__in=unpaid_store_ids_for_month())
    )


def _max_price():
    return 999999999999


ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _save_product_image(image):
    """Persist an uploaded image and return its media URL."""
    ext = Path(image.name).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        return None, "Image must be JPG, PNG, WEBP or GIF."

    if image.size > 5 * 1024 * 1024:
        return None, "Image must be 5MB or smaller."

    upload_dir = Path(settings.MEDIA_ROOT) / "products"
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    (upload_dir / filename).write_bytes(image.read())

    url = f"{settings.MEDIA_URL}products/{filename}"
    return url, None


def _store_categories(store):
    """The categories a vendor may assign to listings (from registration).

    Each option says whether listings in it are products or services. A store
    selling both only offers its sub-categories (the "Goods & Services" main
    category is ambiguous).
    """
    categories = []
    main_cat = store.category
    if main_cat and store.listing_kind != "both":
        categories.append(
            {
                "id": str(main_cat.pk),
                "name": main_cat.name,
                "parent": None,
                "listing_type": store.listing_kind,
            }
        )
    for sub in StoreCategory.objects.filter(id__in=store.categories.all()).select_related("parent"):
        categories.append(
            {
                "id": str(sub.pk),
                "name": sub.name,
                "parent": sub.parent.name if sub.parent_id else "",
                "listing_type": listing_type_for_category(sub),
            }
        )
    return categories


def _category_repr(pc):
    if pc is None:
        return {"category": "", "subcategory": ""}
    if pc.parent_id:
        return {"category": pc.parent.name, "subcategory": pc.name}
    return {"category": pc.name, "subcategory": ""}


def _listing_type_for(store, sc):
    """Product or service, decided by the category the listing is in."""
    if sc.pk == store.category_id and store.listing_kind != "both":
        return ListingType.SERVICE if store.listing_kind == "service" else ListingType.PRODUCT
    return (
        ListingType.SERVICE
        if listing_type_for_category(sc) == "service"
        else ListingType.PRODUCT
    )


def _product_category_for(sc):
    """Map a StoreCategory selection to a (main, sub) ProductCategory pair."""
    main_name = sc.parent.name if sc.parent_id else sc.name
    main_pc, _ = ProductCategory.objects.get_or_create(
        name__iexact=main_name, parent__isnull=True, defaults={"name": main_name}
    )
    if sc.parent_id:
        sub_name = sc.name
        sub_pc, _ = ProductCategory.objects.get_or_create(
            name__iexact=sub_name, parent=main_pc, defaults={"name": sub_name}
        )
        return sub_pc
    return main_pc


def _parse_fields(request, data):
    """Extract fields from either JSON or multipart requests."""
    if (request.content_type or "").startswith("application/json"):
        try:
            data = json.loads(request.body or "{}") if data is None else data
        except json.JSONDecodeError:
            return {"error": "Invalid JSON body"}, 400
        title = (data.get("title") or "").strip()
        description = (
            (data.get("description") or "").strip()
            if "description" in data
            else None
        )
        price_provided = "price" in data
        price = data.get("price")
        available = data.get("available", True)
        if isinstance(available, str):
            available = available.lower() not in ("false", "0", "no")
        category_id = data.get("category_id") or data.get("category")
        listing_id = data.get("id") or data.get("listing_id") or ""
    else:
        data = request.POST
        title = (data.get("title") or "").strip()
        description = (
            (data.get("description") or "").strip()
            if "description" in data
            else None
        )
        price_provided = "price" in data
        price = data.get("price")
        available = (data.get("available", "true").lower()) not in ("false", "0", "no")
        category_id = data.get("category_id") or data.get("category")
        listing_id = data.get("id") or data.get("listing_id") or ""

    return {
        "title": title,
        "description": description,
        "price": price,
        "price_provided": price_provided,
        "available": available,
        "category_id": category_id,
        "listing_id": listing_id,
    }, None


def _listing_to_dict(item):
    cat = _category_repr(item.category)
    return {
        "id": str(item.pk),
        "title": item.title,
        "price": str(item.price),
        "currency": item.currency,
        "available": item.is_active,
        "image_url": (
            item.images.filter(is_primary=True).first().image_url
            if item.images.filter(is_primary=True).first()
            else ""
        ),
        "category": cat["category"],
        "subcategory": cat["subcategory"],
        "listing_type": item.listing_type,
        "store": item.store.name,
        "description": item.description,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@csrf_exempt
def vendor_listings_view(request):
    """List, create and update the logged-in vendor's store listings."""
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)

    store = Store.objects.select_related("category").filter(owner=request.user).first()
    if store is None:
        return JsonResponse(
            {"error": "No store linked to this account."}, status=400
        )

    store_kind = store.listing_kind
    listing_label = {"product": "product", "service": "service"}.get(store_kind, "item")

    if request.method == "GET":
        listings = store.listings.select_related("category", "category__parent").order_by(
            "-created_at"
        )
        return JsonResponse(
            {
                "store": {
                    "id": str(store.pk),
                    "name": store.name,
                    "category": store.category.name if store.category_id else "",
                    # "product", "service" or "both"
                    "listing_type": store_kind,
                },
                "categories": _store_categories(store),
                "listings": [_listing_to_dict(item) for item in listings],
            }
        )

    if request.method in ("POST", "PATCH", "PUT"):
        fields, parse_error = _parse_fields(request, None)
        if parse_error:
            return JsonResponse(parse_error, status=400)

        if fields["listing_id"]:
            return _update_listing(request, store, fields)

        # Create
        if not fields["title"]:
            return JsonResponse(
                {"error": f"{listing_label.title()} name is required."}, status=400
            )
        sc = _validated_category(store, fields["category_id"]) if fields["category_id"] else None
        if sc is None:
            return JsonResponse(
                {"error": f"Choose a category for this {listing_label}."}, status=400
            )
        listing_type = _listing_type_for(store, sc)
        is_service = listing_type == ListingType.SERVICE
        listing_label = "service" if is_service else "product"

        if is_service and fields["price"] in (None, ""):
            price = 0
        else:
            try:
                price = float(fields["price"])
            except (TypeError, ValueError):
                return JsonResponse({"error": "A valid price is required."}, status=400)
        if price < 0 or price > _max_price():
            return JsonResponse({"error": "Enter a valid price."}, status=400)

        image = request.FILES.get("image")
        if image is None:
            return JsonResponse(
                {"error": f"A {listing_label} image is required."}, status=400
            )
        image_url, image_error = _save_product_image(image)
        if image_error:
            return JsonResponse({"error": image_error}, status=400)

        pc = _product_category_for(sc)

        listing = Listing.objects.create(
            store=store,
            category=pc,
            title=fields["title"],
            description=fields["description"] or "",
            listing_type=listing_type,
            price=price,
            currency="TZS",
            stock_quantity=None,
            unit="" if is_service else "each",
            is_active=bool(fields["available"]),
            created_by=request.user,
            updated_by=request.user,
        )
        ListingImage.objects.create(
            listing=listing,
            image_url=image_url,
            is_primary=True,
            created_by=request.user,
            updated_by=request.user,
        )
        listing = Listing.objects.select_related("category", "category__parent").get(
            pk=listing.pk
        )
        return JsonResponse({"listing": _listing_to_dict(listing)}, status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


def _update_listing(request, store, fields):
    """Edit an existing listing or flip its availability."""
    listing = (
        Listing.objects.select_related("category", "category__parent")
        .filter(pk=fields["listing_id"], store=store)
        .first()
    )
    if listing is None:
        return JsonResponse({"error": "Listing not found."}, status=404)

    # A new category can turn a product into a service (or back).
    sc = None
    if fields["category_id"]:
        sc = _validated_category(store, fields["category_id"])
        if sc is None:
            return JsonResponse({"error": "Choose a category for this listing."}, status=400)
        listing.listing_type = _listing_type_for(store, sc)
    is_service = listing.listing_type == ListingType.SERVICE

    if fields["title"]:
        listing.title = fields["title"]
    if fields["description"] is not None:
        listing.description = fields["description"]
    if fields["price_provided"]:
        if is_service and fields["price"] in (None, ""):
            price = 0
        else:
            try:
                price = float(fields["price"])
            except (TypeError, ValueError):
                return JsonResponse({"error": "A valid price is required."}, status=400)
        if price < 0 or price > _max_price():
            return JsonResponse({"error": "Enter a valid price."}, status=400)
        listing.price = price
    listing.is_active = bool(fields["available"])

    if sc is not None:
        listing.category = _product_category_for(sc)
        listing.unit = "" if is_service else (listing.unit or "each")

    listing.updated_by = request.user
    listing.save()

    image = request.FILES.get("image")
    if image is not None:
        new_url, image_error = _save_product_image(image)
        if image_error:
            return JsonResponse({"error": image_error}, status=400)
        primary = listing.images.filter(is_primary=True).first()
        if primary:
            primary.image_url = new_url
            primary.updated_by = request.user
            primary.save(update_fields=["image_url", "updated_by"])
        else:
            ListingImage.objects.create(
                listing=listing,
                image_url=new_url,
                is_primary=True,
                created_by=request.user,
                updated_by=request.user,
            )

    listing = Listing.objects.select_related("category", "category__parent").get(
        pk=listing.pk
    )
    return JsonResponse({"listing": _listing_to_dict(listing)})


def _validated_category(store, category_id):
    allowed_ids = set(store.categories.values_list("pk", flat=True))
    if store.category_id and store.listing_kind != "both":
        allowed_ids.add(store.category_id)
    sc = StoreCategory.objects.filter(pk=category_id).first() if category_id else None
    if sc is None or sc.pk not in allowed_ids:
        return None
    return sc


def public_catalog_view(request):
    """Public landing-page feed of active listings (products + services)."""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    listings = (
        Listing.objects.filter(is_active=True)
        .select_related("store", "category", "category__parent")
        .prefetch_related("images")
        .order_by("-created_at")[:40]
    )

    products = []
    services = []
    for item in listings:
        d = _listing_to_dict(item)
        if item.listing_type == ListingType.SERVICE and len(services) < 10:
            services.append(d)
        elif item.listing_type == ListingType.PRODUCT and len(products) < 12:
            products.append(d)

    return JsonResponse({"products": products, "services": services})


def _public_listing_to_dict(item, tag):
    """Public catalog card for the landing page (products & services)."""
    base = _listing_to_dict(item)
    price = float(item.price)
    old_price = (
        float(item.discount_price)
        if item.discount_price is not None
        else None
    )
    sale = None
    if old_price is not None and old_price > price:
        sale = f"-{round((1 - price / old_price) * 100)}%"
    return {
        **base,
        "tag": tag,
        "store": item.store.name,
        "description": item.description,
        "discount": old_price,
        "sale": sale,
        "currency": item.currency,
    }


def public_catalog_view(request):
    """Public catalog of all active listings, split into products & services."""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    rows = (
        purchasable_listings()
        .select_related("store", "category", "category__parent")
        .order_by("-created_at")[:40]
    )

    products = []
    services = []
    for item in rows:
        tag = "service" if item.listing_type == ListingType.SERVICE else "product"
        entry = _public_listing_to_dict(item, tag)
        if tag == "service":
            services.append(entry)
        else:
            products.append(entry)

    return JsonResponse({
        "products": products,
        "services": services,
    })


def _admin_listing_payload(item):
    cat = _category_repr(item.category)
    images = list(item.images.all())
    primary = next((img for img in images if img.is_primary), None) or (
        images[0] if images else None
    )
    return {
        "id": str(item.pk),
        "title": item.title,
        "description": item.description,
        "listing_type": item.listing_type,
        "price": str(item.price),
        "currency": item.currency,
        "is_active": item.is_active,
        "image_url": primary.image_url if primary else "",
        "category": cat["category"],
        "subcategory": cat["subcategory"],
        "store": item.store.name,
        "store_id": str(item.store_id),
        "store_status": item.store.status,
        "unit": item.unit,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@csrf_exempt
def admin_products_view(request):
    """Admin: list every listing (product/service) across all stores."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    listings = (
        Listing.objects.select_related("store", "category", "category__parent")
        .prefetch_related("images")
        .order_by("-created_at")
    )
    items = [_admin_listing_payload(item) for item in listings]
    return JsonResponse(
        {
            "success": True,
            "products": items,
            "counts": {
                "total": len(items),
                "products": sum(
                    1 for i in items if i["listing_type"] == ListingType.PRODUCT
                ),
                "services": sum(
                    1 for i in items if i["listing_type"] == ListingType.SERVICE
                ),
                "active": sum(1 for i in items if i["is_active"]),
                "inactive": sum(1 for i in items if not i["is_active"]),
            },
        }
    )


@csrf_exempt
def admin_product_update_view(request, listing_id):
    """Admin: show or hide a listing on the public portal."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    is_active = data.get("is_active")
    if not isinstance(is_active, bool):
        return JsonResponse({"error": "is_active must be a boolean."}, status=400)

    listing = (
        Listing.objects.select_related("store", "category", "category__parent")
        .prefetch_related("images")
        .filter(pk=listing_id)
        .first()
    )
    if listing is None:
        return JsonResponse({"error": "Product not found."}, status=404)

    listing.is_active = is_active
    listing.updated_by = request.user
    listing.save(update_fields=["is_active", "updated_by", "updated_at"])

    return JsonResponse(
        {"success": True, "product": _admin_listing_payload(listing)}
    )