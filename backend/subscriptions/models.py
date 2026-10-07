import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class SubscriptionStatus(models.TextChoices):
    UNPAID = 'unpaid', _('Unpaid')
    PAID = 'paid', _('Paid')


class SubscriptionInvoice(models.Model):
    """Monthly subscription fee billed to a store (SaaS model, no commission)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='subscription_invoices',
    )
    period_month = models.DateField(
        help_text=_('First day of the billed month (e.g. 2026-09-01)')
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=10,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.UNPAID
    )
    notes = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='paid_subscription_invoices',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_subscription_invoices',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_subscription_invoices',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscription_invoices'
        verbose_name = _('subscription invoice')
        verbose_name_plural = _('subscription invoices')
        ordering = ['-period_month']
        constraints = [
            models.UniqueConstraint(
                fields=['store', 'period_month'],
                name='uq_subscription_store_month',
            )
        ]
        indexes = [
            models.Index(fields=['period_month', 'status']),
            models.Index(fields=['store', '-period_month']),
        ]

    def __str__(self):
        status_label = self.get_status_display().lower()
        return f"{self.store.name} · {self.period_month} · {status_label}"