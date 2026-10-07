from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import EmailVerification, User


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("phone_number", "email", "first_name", "last_name", "role")


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = User
    ordering = ("-created_at",)
    list_display = (
        "phone_number",
        "email",
        "full_name",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "created_at",
    )
    list_filter = (
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "is_verified",
        "email_verified",
    )
    search_fields = ("phone_number", "email", "first_name", "last_name")
    readonly_fields = ("id", "last_login", "date_joined", "created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("id", "phone_number", "email", "password")}),
        ("Personal information", {"fields": ("first_name", "last_name")}),
        (
            "Role and verification",
            {"fields": ("role", "is_verified", "email_verified")},
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Audit", {"fields": ("created_by", "updated_by", "last_login", "date_joined", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "phone_number",
                    "email",
                    "first_name",
                    "last_name",
                    "role",
                    "password1",
                    "password2",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )
    filter_horizontal = ("groups", "user_permissions")

    @admin.display(description="Name")
    def full_name(self, obj):
        return obj.get_full_name() or "—"

    def save_model(self, request, obj, form, change):
        if change:
            obj.updated_by = request.user
        elif obj.created_by_id is None:
            obj.created_by = request.user
            obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    list_display = ("email", "is_verified", "is_completed", "created_at", "expires_at")
    list_filter = ("is_verified", "is_completed")
    search_fields = ("email",)
    readonly_fields = ("id", "token", "created_at")
    ordering = ("-created_at",)
