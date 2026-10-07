import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import (
    authenticate,
    get_user_model,
    login,
    logout,
    update_session_auth_hash,
)
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail.message import EmailMultiAlternatives
from django.core.validators import validate_email
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import EmailVerification, UserRole
from stores.models import (
    BOTH_ROOT,
    GOODS_ROOT,
    SERVICES_ROOT,
    Store,
    StoreCategory,
    listing_type_for_category,
)

User = get_user_model()


def _user_payload(user):
    store = Store.objects.filter(owner=user).first()
    return {
        "authenticated": True,
        "id": str(user.pk),
        "username": user.get_username(),
        "name": user.get_full_name() or user.get_username(),
        "email": user.email or "",
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
        "role": getattr(user, "role", None),
        "store": (
            {
                "name": store.name,
                "category": store.category.name if store.category_id else "",
            }
            if store
            else None
        ),
    }


def _default_redirect(user):
    if user.is_superuser or user.is_staff:
        return "/admin"
    if getattr(user, "role", None) == UserRole.VENDOR_OWNER:
        return "/vendor"
    return "/"


@csrf_exempt
def login_view(request):
    """Authenticate a user (by email or username) and start a session."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    identifier = (data.get("email") or data.get("username") or "").strip()
    password = data.get("password") or ""

    if not identifier or not password:
        return JsonResponse({"error": "Email and password are required."}, status=400)

    user = authenticate(request, username=identifier, password=password)

    if user is None:
        try:
            matched = User.objects.get(email__iexact=identifier)
            user = authenticate(request, username=matched.get_username(), password=password)
        except User.DoesNotExist:
            user = None

    if user is None or not user.is_active:
        return JsonResponse({"error": "Invalid email or password."}, status=401)

    login(request, user)
    payload = _user_payload(user)
    payload["redirect"] = _default_redirect(user)
    return JsonResponse(payload)


@csrf_exempt
def me_view(request):
    """Return the currently logged-in user (or 401 if anonymous)."""
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)
    return JsonResponse(_user_payload(request.user))


@csrf_exempt
def profile_view(request):
    """Return the full profile of the logged-in user, including their store."""
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)

    user = request.user
    store = (
        Store.objects.select_related("category", "region")
        .filter(owner=user)
        .first()
    )

    payload = _user_payload(user)
    payload["profile"] = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone_number": user.phone_number,
        "email": user.email or "",
        "email_verified": user.email_verified,
        "member_since": user.created_at.isoformat() if user.created_at else None,
    }
    payload["store"] = (
        {
            "name": store.name,
            "slug": store.slug,
            "description": store.description,
            "category": store.category.name if store.category_id else "",
            "additional_categories": [
                c.name for c in store.categories.all()
            ],
            "region": store.region.name if store.region_id else "",
            "latitude": str(store.latitude) if store.latitude else None,
            "longitude": str(store.longitude) if store.longitude else None,
            "logo_url": store.logo_url,
            "banner_url": store.banner_url,
            "status": store.status,
            "rating_avg": str(store.rating_avg),
            "rating_count": store.rating_count,
            "created_at": store.created_at.isoformat() if store.created_at else None,
        }
        if store
        else None
    )
    return JsonResponse(payload)


@csrf_exempt
def logout_view(request):
    """End the current user's session."""
    logout(request)
    return JsonResponse({"success": True})


@csrf_exempt
def register_request_view(request):
    """Step 1: request an email verification link for vendor registration."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    email = (data.get("email") or "").strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"error": "Please enter a valid email address."}, status=400)

    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse(
            {"error": "An account with this email already exists. Please log in."},
            status=409,
        )

    token = secrets.token_urlsafe(48)
    verification = EmailVerification.objects.create(
        email=email,
        token=token,
        expires_at=timezone.now() + timedelta(hours=24),
    )

    link = f"{settings.FRONTEND_URL}/register?token={verification.token}"
    try:
        subject = "Verify your email to start selling on Magic Expressway"
        text_body = (
            f"Welcome to Magic Expressway!\n\n"
            f"Please verify your email address to continue with your vendor "
            f"registration.\n\n{link}\n\n"
            f"(It expires in 24 hours. If you didn't request this, you can "
            f"safely ignore this email.)"
        )
        html_body = render_to_string(
            "auths/verify_email.html",
            {"link": link, "email": email, "year": timezone.now().year},
        )
        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(using="default")
    except Exception as exc:
        verification.delete()
        backend = settings.MAILERS.get("default", {}).get("BACKEND", "")
        detail = ""
        if "smtp" in backend.lower():
            detail = (
                " Check your SMTP credentials in backend/.env "
                "(EMAIL_HOST_USER / EMAIL_HOST_PASSWORD)."
            )
        return JsonResponse(
            {
                "error": f"Could not send the verification email.{detail}"
                f" ({type(exc).__name__})"
            },
            status=502,
        )

    payload = {
        "success": True,
        "message": f"We've sent a verification link to {email}.",
    }
    if settings.DEBUG:
        payload["dev_url"] = link
    return JsonResponse(payload)


@csrf_exempt
def register_verify_view(request):
    """Step 2: validate the emailed verification token."""
    token = ""
    if request.method == "GET":
        token = (request.GET.get("token") or "").strip()
    elif request.method == "POST":
        try:
            data = json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        token = (data.get("token") or "").strip()
    else:
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not token:
        return JsonResponse(
            {"error": "Missing verification token."}, status=400
        )

    try:
        verification = EmailVerification.objects.get(token=token)
    except EmailVerification.DoesNotExist:
        return JsonResponse(
            {"error": "Invalid or expired verification link."}, status=400
        )

    if verification.is_expired:
        return JsonResponse(
            {"error": "This verification link has expired. Please request a new one."},
            status=400,
        )
    if verification.is_completed:
        return JsonResponse(
            {"error": "This verification link has already been used."}, status=400
        )
    if User.objects.filter(email__iexact=verification.email).exists():
        return JsonResponse(
            {"error": "An account with this email already exists. Please log in."},
            status=409,
        )

    if not verification.is_verified:
        verification.is_verified = True
        verification.save(update_fields=["is_verified"])

    return JsonResponse(
        {
            "success": True,
            "email": verification.email,
            "message": "Email verified. Complete your registration.",
        }
    )


@csrf_exempt
def register_complete_view(request):
    """Step 3: create the vendor account and store."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    token = (data.get("token") or "").strip()
    if not token:
        return JsonResponse({"error": "Missing verification token."}, status=400)

    try:
        verification = EmailVerification.objects.get(token=token)
    except EmailVerification.DoesNotExist:
        return JsonResponse(
            {"error": "Invalid or expired verification link. Restart registration."},
            status=400,
        )

    if verification.is_expired:
        return JsonResponse(
            {"error": "This verification link has expired. Please request a new one."},
            status=400,
        )
    if not verification.is_verified:
        return JsonResponse(
            {"error": "Email not verified. Restart registration."}, status=400
        )
    if verification.is_completed:
        return JsonResponse(
            {"error": "This verification link has already been used."}, status=400
        )

    email = verification.email
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse(
            {"error": "An account with this email already exists. Please log in."},
            status=409,
        )

    full_name = (data.get("full_name") or "").strip()
    phone_number = (data.get("phone_number") or "").strip()
    password = data.get("password") or ""
    store_name = (data.get("store_name") or "").strip()
    category_type = (data.get("category_type") or "").strip().lower()
    selected = data.get("categories") or []

    latitude = data.get("latitude")
    longitude = data.get("longitude")
    try:
        latitude = float(latitude) if latitude is not None else None
        longitude = float(longitude) if longitude is not None else None
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid store location coordinates."}, status=400)
    if latitude is None or longitude is None:
        return JsonResponse(
            {"error": "Please place your store on the map."}, status=400
        )
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        return JsonResponse({"error": "Invalid store location coordinates."}, status=400)

    if not full_name or not phone_number or not store_name:
        return JsonResponse({"error": "Please fill in all required fields."}, status=400)
    if category_type not in ("goods", "services", "both"):
        return JsonResponse(
            {"error": "Choose what you sell: goods, services or both."}, status=400
        )
    if not isinstance(selected, list) or not selected:
        return JsonResponse(
            {
                "error": "Select at least one category you sell "
                f"({'goods and services' if category_type == 'both' else category_type})."
            },
            status=400,
        )

    if User.objects.filter(phone_number=phone_number).exists():
        return JsonResponse(
            {"error": "An account with this phone number already exists."},
            status=409,
        )

    try:
        validate_password(password)
    except ValidationError as exc:
        return JsonResponse({"error": "; ".join(exc.messages)}, status=400)

    def root(name):
        category, _ = StoreCategory.objects.get_or_create(
            name__iexact=name, parent__isnull=True, defaults={"name": name}
        )
        return category

    if category_type == "both":
        main_category = root(BOTH_ROOT)
        parents = [root(GOODS_ROOT), root(SERVICES_ROOT)]
    else:
        main_category = root(GOODS_ROOT if category_type == "goods" else SERVICES_ROOT)
        parents = [main_category]

    selected_categories = list(
        StoreCategory.objects.filter(parent__in=parents, name__in=selected).select_related("parent")
    )
    if not selected_categories:
        return JsonResponse({"error": "Select at least one category you sell."}, status=400)
    if category_type == "both":
        kinds = {listing_type_for_category(c) for c in selected_categories}
        if kinds != {"product", "service"}:
            return JsonResponse(
                {"error": "Select at least one goods category and one services category."},
                status=400,
            )

    names = full_name.split(maxsplit=1)
    user = User.objects.create_user(
        phone_number=phone_number,
        password=password,
        email=email,
        role=UserRole.VENDOR_OWNER,
        email_verified=True,
        is_active=True,
        first_name=names[0],
        last_name=names[1] if len(names) > 1 else "",
    )

    description = (data.get("description") or "").strip()
    store = Store.objects.create(
        owner=user,
        name=store_name,
        category=main_category,
        description=description,
        latitude=latitude,
        longitude=longitude,
    )

    store.categories.set(selected_categories)

    verification.is_completed = True
    verification.save(update_fields=["is_completed"])

    user.backend = "django.contrib.auth.backends.ModelBackend"
    login(request, user)
    payload = _user_payload(user)
    payload["redirect"] = "/vendor"
    return JsonResponse(payload)


def _is_admin(user):
    """True when the given user is a platform administrator."""
    return bool(
        user.is_authenticated
        and (
            user.is_superuser
            or user.is_staff
            or getattr(user, "role", None) == UserRole.ADMIN
        )
    )


def _admin_user_payload(user):
    store = user.owned_stores.first()
    return {
        "id": str(user.pk),
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "name": user.get_full_name() or user.get_username(),
        "phone_number": user.phone_number,
        "email": user.email or "",
        "role": getattr(user, "role", "") or "",
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "email_verified": user.email_verified,
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "store": (
            {
                "name": store.name,
                "status": store.status,
                "category": store.category.name if store.category_id else "",
            }
            if store
            else None
        ),
    }


@csrf_exempt
def admin_users_view(request):
    """Admin: list every user (admins + vendors) with account status."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    users = User.objects.prefetch_related(
        "owned_stores", "owned_stores__category"
    ).order_by("-created_at")
    items = [_admin_user_payload(user) for user in users]
    return JsonResponse(
        {
            "success": True,
            "users": items,
            "counts": {
                "total": len(items),
                "active": sum(1 for u in items if u["is_active"]),
                "inactive": sum(1 for u in items if not u["is_active"]),
                "vendors": sum(
                    1 for u in items if u["role"] == UserRole.VENDOR_OWNER
                ),
                "admins": sum(1 for u in items if u["role"] == UserRole.ADMIN),
            },
        }
    )


@csrf_exempt
def admin_user_update_view(request, user_id):
    """Admin: edit a user's details and/or activate/deactivate the account."""
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    if "role" in data:
        role = data.get("role")
        if role not in UserRole.values:
            return JsonResponse({"error": "Invalid role."}, status=400)
        if (
            user.pk == request.user.pk
            and getattr(user, "role", None) == UserRole.ADMIN
            and role != UserRole.ADMIN
        ):
            return JsonResponse(
                {"error": "You cannot demote your own admin role."}, status=400
            )
        user.role = role

    if "first_name" in data:
        user.first_name = (data.get("first_name") or "").strip()
    if "last_name" in data:
        user.last_name = (data.get("last_name") or "").strip()

    if "phone_number" in data:
        phone = (data.get("phone_number") or "").strip()
        if not phone:
            return JsonResponse({"error": "Phone number is required."}, status=400)
        if len(phone) > 15:
            return JsonResponse({"error": "Phone number is too long."}, status=400)
        if (
            User.objects.filter(phone_number=phone)
            .exclude(pk=user.pk)
            .exists()
        ):
            return JsonResponse(
                {"error": "An account with this phone number already exists."},
                status=409,
            )
        user.phone_number = phone

    if "email" in data:
        email = (data.get("email") or "").strip().lower() or None
        if email:
            try:
                validate_email(email)
            except ValidationError:
                return JsonResponse(
                    {"error": "Please enter a valid email address."}, status=400
                )
            if (
                User.objects.filter(email__iexact=email)
                .exclude(pk=user.pk)
                .exists()
            ):
                return JsonResponse(
                    {"error": "An account with this email already exists."},
                    status=409,
                )
        user.email = email

    if "is_active" in data:
        is_active = data.get("is_active")
        if not isinstance(is_active, bool):
            return JsonResponse(
                {"error": "is_active must be a boolean."}, status=400
            )
        if not is_active and user.pk == request.user.pk:
            return JsonResponse(
                {"error": "You cannot deactivate your own account."}, status=400
            )
        user.is_active = is_active

    for field in ("is_verified", "email_verified"):
        if field in data:
            value = data.get(field)
            if not isinstance(value, bool):
                return JsonResponse(
                    {"error": f"{field} must be a boolean."}, status=400
                )
            setattr(user, field, value)

    user.updated_by = request.user
    user.save()

    return JsonResponse(
        {"success": True, "user": _admin_user_payload(user)}
    )


# Easy to read aloud / type on a phone: no 0/O, 1/l/I.
_PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_password(length=10):
    while True:
        password = "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))
        if (
            any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
        ):
            return password


@csrf_exempt
def admin_user_password_view(request, user_id):
    """Admin: reset a user's password.

    POST {"password": "..."} to set a chosen password, or {"generate": true}
    to create a random one. The new password is returned once so the admin
    can pass it on. All of the user's existing sessions are signed out.
    """
    if not _is_admin(request.user):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return JsonResponse({"error": "User not found."}, status=404)

    if data.get("generate") is True:
        password = _generate_password()
    else:
        password = data.get("password") or ""
        if not isinstance(password, str) or not password:
            return JsonResponse({"error": "Enter a new password."}, status=400)
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            return JsonResponse({"error": " ".join(exc.messages)}, status=400)

    user.set_password(password)
    user.updated_by = request.user
    user.save(update_fields=["password", "updated_by", "updated_at"])

    # Changing the password invalidates the user's other sessions. Keep the
    # admin signed in if they reset their own password.
    if user.pk == request.user.pk:
        update_session_auth_hash(request, user)

    return JsonResponse({
        "success": True,
        "user_id": str(user.pk),
        "password": password,
    })