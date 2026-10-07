import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class Cart(models.Model):
    """Shopping cart for customers"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cart'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_carts'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_carts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'carts'
        verbose_name = _('cart')
        verbose_name_plural = _('carts')
    
    def __str__(self):
        return f"Cart for {self.customer.phone_number}"


class CartItem(models.Model):
    """Items in shopping cart"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items'
    )
    listing = models.ForeignKey(
        'catalog.Listing',
        on_delete=models.CASCADE,
        related_name='cart_items'
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price_snapshot = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text=_('Price at the time item was added to cart')
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cart_items'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_cart_items'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'cart_items'
        verbose_name = _('cart item')
        verbose_name_plural = _('cart items')
        unique_together = [['cart', 'listing']]
        indexes = [
            models.Index(fields=['cart']),
        ]
    
    def __str__(self):
        return f"{self.quantity}x {self.listing.title}"
