import uuid
from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from django.conf import settings


class Region(models.Model):
    """Tanzania administrative regions"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_regions'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_regions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'regions'
        verbose_name = _('region')
        verbose_name_plural = _('regions')
        ordering = ['name']
    
    def __str__(self):
        return self.name


class StoreCategory(models.Model):
    """Store categories with hierarchical support"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=50, blank=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subcategories'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_store_categories'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_store_categories'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'store_categories'
        verbose_name = _('store category')
        verbose_name_plural = _('store categories')
        ordering = ['name']
    
    def __str__(self):
        return self.name


class StoreStatus(models.TextChoices):
    PENDING = 'pending', _('Pending')
    APPROVED = 'approved', _('Approved')
    SUSPENDED = 'suspended', _('Suspended')
    REJECTED = 'rejected', _('Rejected')


# Root store categories. A store sells goods, services, or both; its main
# category is one of these names.
GOODS_ROOT = 'Goods'
SERVICES_ROOT = 'Services'
BOTH_ROOT = 'Goods & Services'


def listing_type_for_category(store_category):
    """'service' for categories under Services, otherwise 'product'."""
    root = store_category.parent if store_category.parent_id else store_category
    return 'service' if root.name.lower() == SERVICES_ROOT.lower() else 'product'


class SubscriptionPlan(models.TextChoices):
    FREE = 'free', _('Free')
    MONTHLY = 'monthly', _('Monthly')


class Store(models.Model):
    """Vendor stores"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_stores'
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.PROTECT,
        related_name='stores',
        null=True,
        blank=True,
        help_text=_('Store region (optional until vendor completes location setup)')
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text=_('Store latitude coordinate')
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text=_('Store longitude coordinate')
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    logo_url = models.URLField(max_length=500, blank=True)
    banner_url = models.URLField(max_length=500, blank=True)
    category = models.ForeignKey(
        StoreCategory,
        on_delete=models.PROTECT,
        related_name='stores'
    )
    categories = models.ManyToManyField(
        StoreCategory,
        related_name='stores_by_category',
        blank=True,
        help_text=_('Additional goods/services categories the store sells')
    )
    status = models.CharField(
        max_length=20,
        choices=StoreStatus.choices,
        default=StoreStatus.PENDING
    )
    subscription_plan = models.CharField(
        max_length=10,
        choices=SubscriptionPlan.choices,
        default=SubscriptionPlan.FREE,
        help_text=_('Free stores are never billed; monthly stores get a monthly invoice')
    )
    monthly_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Fee billed each month on the monthly plan')
    )
    plan_updated_at = models.DateTimeField(null=True, blank=True)
    commission_override_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Override platform commission percentage for this store')
    )
    rating_avg = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.00,
        help_text=_('Denormalized average rating')
    )
    rating_count = models.PositiveIntegerField(
        default=0,
        help_text=_('Denormalized review count')
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_stores'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_stores'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_stores'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'stores'
        verbose_name = _('store')
        verbose_name_plural = _('stores')
        indexes = [
            models.Index(fields=['region', 'status']),
            models.Index(fields=['owner']),
            models.Index(fields=['slug']),
        ]
    
    def __str__(self):
        return self.name

    @property
    def listing_kind(self):
        """What the store lists: 'product', 'service' or 'both'."""
        name = self.category.name.lower() if self.category_id else ''
        if name == BOTH_ROOT.lower():
            return 'both'
        if name == SERVICES_ROOT.lower():
            return 'service'
        return 'product'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
            # Ensure uniqueness
            original_slug = self.slug
            counter = 1
            while Store.objects.filter(slug=self.slug).exists():
                self.slug = f"{original_slug}-{counter}"
                counter += 1
        super().save(*args, **kwargs)
