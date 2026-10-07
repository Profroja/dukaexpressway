import uuid
from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class ProductCategory(models.Model):
    """Product/service categories with hierarchical support"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subcategories'
    )
    icon = models.CharField(max_length=50, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_product_categories'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_product_categories'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'product_categories'
        verbose_name = _('product category')
        verbose_name_plural = _('product categories')
        ordering = ['name']
    
    def __str__(self):
        return self.name


class ListingType(models.TextChoices):
    PRODUCT = 'product', _('Product')
    SERVICE = 'service', _('Service')


class Listing(models.Model):
    """Products and services offered by stores"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='listings'
    )
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.PROTECT,
        related_name='listings'
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    listing_type = models.CharField(
        max_length=10,
        choices=ListingType.choices,
        default=ListingType.PRODUCT
    )
    price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    currency = models.CharField(max_length=3, default='TZS')
    stock_quantity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=_('Null for services')
    )
    unit = models.CharField(
        max_length=50,
        blank=True,
        help_text=_('e.g., kg, piece, hour')
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_listings'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_listings'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'listings'
        verbose_name = _('listing')
        verbose_name_plural = _('listings')
        indexes = [
            models.Index(fields=['store', 'is_active']),
            models.Index(fields=['category']),
            models.Index(fields=['listing_type']),
        ]
    
    def __str__(self):
        return self.title
    
    def clean(self):
        """Validate that services don't have stock_quantity"""
        if self.listing_type == ListingType.SERVICE and self.stock_quantity is not None:
            raise ValidationError({
                'stock_quantity': _('Services cannot have stock quantity.')
            })


class ListingImage(models.Model):
    """Images for listings"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image_url = models.URLField(max_length=500)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_listing_images'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_listing_images'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'listing_images'
        verbose_name = _('listing image')
        verbose_name_plural = _('listing images')
        ordering = ['sort_order']
        indexes = [
            models.Index(fields=['listing', 'is_primary']),
        ]
    
    def __str__(self):
        return f"Image for {self.listing.title}"
