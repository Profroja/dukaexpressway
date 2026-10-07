from django.contrib import admin

from .models import SubscriptionInvoice


@admin.register(SubscriptionInvoice)
class SubscriptionInvoiceAdmin(admin.ModelAdmin):
    list_display = ('store', 'period_month', 'amount', 'status', 'paid_at')
    list_filter = ('status', 'period_month')
    search_fields = ('store__name',)
    ordering = ('-period_month',)