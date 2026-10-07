from django.contrib import admin

from .models import QuickOrder, StorePurchaseOrder


class StorePurchaseOrderInline(admin.TabularInline):
    model = StorePurchaseOrder
    extra = 0
    fields = ("po_number", "store", "listing_title_snapshot", "quantity", "unit_price", "total_amount", "status")
    readonly_fields = fields
    can_delete = False
    show_change_link = True


@admin.register(QuickOrder)
class QuickOrderAdmin(admin.ModelAdmin):
    list_display = ("customer_name", "customer_phone", "listing", "quantity", "total_amount", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("customer_name", "customer_phone", "listing__title")
    inlines = [StorePurchaseOrderInline]


@admin.register(StorePurchaseOrder)
class StorePurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("po_number", "store", "listing_title_snapshot", "quantity", "total_amount", "status", "created_at")
    list_filter = ("status", "store")
    search_fields = ("po_number", "listing_title_snapshot", "store__name")
