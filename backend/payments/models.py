import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class PaymentMethod(models.TextChoices):
    MPESA = 'mpesa', _('M-Pesa')
    TIGOPESA = 'tigopesa', _('Tigo Pesa')
    AIRTELMONEY = 'airtelmoney', _('Airtel Money')
    CARD = 'card', _('Card')
    CASH_ON_DELIVERY = 'cash_on_delivery', _('Cash on Delivery')


class PaymentStatus(models.TextChoices):
    INITIATED = 'initiated', _('Initiated')
    PENDING = 'pending', _('Pending')
    SUCCESS = 'success', _('Success')
    FAILED = 'failed', _('Failed')
    REFUNDED = 'refunded', _('Refunded')


class Payment(models.Model):
    """Payment transactions"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.PROTECT,
        related_name='payments'
    )
    method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='TZS')
    status = models.CharField(
        max_length=15,
        choices=PaymentStatus.choices,
        default=PaymentStatus.INITIATED
    )
    gateway_reference = models.CharField(
        max_length=255,
        blank=True,
        help_text=_('Reference from payment gateway')
    )
    gateway_response = models.JSONField(
        null=True,
        blank=True,
        help_text=_('Full response from payment gateway')
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_payments'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'payments'
        verbose_name = _('payment')
        verbose_name_plural = _('payments')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order']),
            models.Index(fields=['gateway_reference']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Payment {self.id} - {self.order.order_number}"
