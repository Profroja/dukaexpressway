import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class CommissionScopeType(models.TextChoices):
    PLATFORM_DEFAULT = 'platform_default', _('Platform Default')
    STORE = 'store', _('Store-Specific')
    CATEGORY = 'category', _('Category-Specific')


class CommissionRule(models.Model):
    """Commission rules with flexible scoping"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scope_type = models.CharField(
        max_length=20,
        choices=CommissionScopeType.choices
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='commission_rules'
    )
    category = models.ForeignKey(
        'catalog.ProductCategory',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='commission_rules'
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text=_('Commission percentage (e.g., 15.00 for 15%)')
    )
    min_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Minimum commission amount')
    )
    max_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Maximum commission amount')
    )
    effective_from = models.DateTimeField()
    effective_to = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_commission_rules'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_commission_rules'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'commission_rules'
        verbose_name = _('commission rule')
        verbose_name_plural = _('commission rules')
        indexes = [
            models.Index(fields=['scope_type', 'is_active']),
            models.Index(fields=['store']),
            models.Index(fields=['category']),
        ]
    
    def __str__(self):
        return f"{self.scope_type} - {self.percentage}%"


class CommissionLedgerStatus(models.TextChoices):
    PENDING = 'pending', _('Pending')
    SETTLED = 'settled', _('Settled')
    HELD = 'held', _('Held')


class CommissionLedger(models.Model):
    """Commission tracking per suborder"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suborder = models.OneToOneField(
        'orders.SubOrder',
        on_delete=models.PROTECT,
        related_name='commission_ledger'
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.PROTECT,
        related_name='commission_ledgers'
    )
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    net_payable = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=10,
        choices=CommissionLedgerStatus.choices,
        default=CommissionLedgerStatus.PENDING
    )
    settled_in_payout = models.ForeignKey(
        'Payout',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='ledger_entries'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_commission_ledgers'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_commission_ledgers'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'commission_ledgers'
        verbose_name = _('commission ledger')
        verbose_name_plural = _('commission ledgers')
        indexes = [
            models.Index(fields=['store', 'status']),
            models.Index(fields=['suborder']),
        ]
    
    def __str__(self):
        return f"Ledger for {self.suborder}"


class PayoutStatus(models.TextChoices):
    PENDING = 'pending', _('Pending')
    PROCESSING = 'processing', _('Processing')
    PAID = 'paid', _('Paid')
    FAILED = 'failed', _('Failed')


class Payout(models.Model):
    """Vendor payouts"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.PROTECT,
        related_name='payouts'
    )
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    total_gross = models.DecimalField(max_digits=12, decimal_places=2)
    total_commission = models.DecimalField(max_digits=12, decimal_places=2)
    total_net_paid = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=15,
        choices=PayoutStatus.choices,
        default=PayoutStatus.PENDING
    )
    payment_method = models.CharField(max_length=50, blank=True)
    reference = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_payouts'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_payouts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'payouts'
        verbose_name = _('payout')
        verbose_name_plural = _('payouts')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', '-created_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Payout for {self.store.name} - {self.period_start.date()}"
