import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class OrderStatus(models.TextChoices):
    PENDING_PAYMENT = 'pending_payment', _('Pending Payment')
    PAID = 'paid', _('Paid')
    PROCESSING = 'processing', _('Processing')
    COMPLETED = 'completed', _('Completed')
    CANCELLED = 'cancelled', _('Cancelled')


class PaymentStatus(models.TextChoices):
    UNPAID = 'unpaid', _('Unpaid')
    PAID = 'paid', _('Paid')
    REFUNDED = 'refunded', _('Refunded')
    PARTIAL_REFUND = 'partial_refund', _('Partial Refund')


class Order(models.Model):
    """Customer orders"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='orders'
    )
    order_number = models.CharField(
        max_length=50,
        unique=True,
        help_text=_('Human-readable order number (e.g., ME-20260917-0007)')
    )
    delivery_address = models.ForeignKey(
        'accounts.Address',
        on_delete=models.PROTECT,
        related_name='orders'
    )
    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING_PAYMENT
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID
    )
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_fee_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    placed_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_orders'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_orders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'orders'
        verbose_name = _('order')
        verbose_name_plural = _('orders')
        ordering = ['-placed_at']
        indexes = [
            models.Index(fields=['customer', '-placed_at']),
            models.Index(fields=['order_number']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return self.order_number


class SubOrderStatus(models.TextChoices):
    PENDING = 'pending', _('Pending')
    ACCEPTED = 'accepted', _('Accepted')
    PREPARING = 'preparing', _('Preparing')
    READY = 'ready', _('Ready')
    OUT_FOR_DELIVERY = 'out_for_delivery', _('Out for Delivery')
    DELIVERED = 'delivered', _('Delivered')
    CANCELLED = 'cancelled', _('Cancelled')
    DISPUTED = 'disputed', _('Disputed')


class SubOrder(models.Model):
    """Store-specific portion of an order"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='suborders'
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.PROTECT,
        related_name='suborders'
    )
    status = models.CharField(
        max_length=20,
        choices=SubOrderStatus.choices,
        default=SubOrderStatus.PENDING
    )
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate_applied = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text=_('Commission percentage applied (snapshot)')
    )
    commission_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text=_('Commission amount (snapshot)')
    )
    vendor_payout_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text=_('Amount payable to vendor (snapshot)')
    )
    delivery_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_suborders'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_suborders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'suborders'
        verbose_name = _('suborder')
        verbose_name_plural = _('suborders')
        indexes = [
            models.Index(fields=['order']),
            models.Index(fields=['store', 'status']),
        ]
    
    def __str__(self):
        return f"{self.order.order_number} - {self.store.name}"


class OrderItem(models.Model):
    """Line items in a suborder"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suborder = models.ForeignKey(
        SubOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )
    listing = models.ForeignKey(
        'catalog.Listing',
        on_delete=models.PROTECT,
        related_name='order_items'
    )
    listing_title_snapshot = models.CharField(
        max_length=255,
        help_text=_('Listing title at time of order')
    )
    quantity = models.PositiveIntegerField()
    unit_price_snapshot = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text=_('Price at time of order')
    )
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_order_items'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_order_items'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'order_items'
        verbose_name = _('order item')
        verbose_name_plural = _('order items')
        indexes = [
            models.Index(fields=['suborder']),
        ]
    
    def __str__(self):
        return f"{self.quantity}x {self.listing_title_snapshot}"


class QuickOrderStatus(models.TextChoices):
    NEW = 'new', _('New')
    CONTACTED = 'contacted', _('Contacted')
    CONFIRMED = 'confirmed', _('Confirmed')
    SOURCING = 'sourcing', _('Sourcing from store')
    PICKED_UP = 'picked_up', _('Picked up / On the way')
    DELIVERED = 'delivered', _('Delivered')
    # Final step: the admin records exactly what the customer paid.
    CLOSED = 'closed', _('Closed (payment recorded)')
    CANCELLED = 'cancelled', _('Cancelled')


class QuickOrder(models.Model):
    """
    Fast guest orders placed with just a name and phone number.

    These are visible to platform admins only. Vendors never see them; the
    admin buys the goods from a store through a StorePurchaseOrder instead,
    so the customer base stays with the platform.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(
        'catalog.Listing',
        on_delete=models.PROTECT,
        related_name='quick_orders'
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.PROTECT,
        related_name='quick_orders'
    )
    customer_name = models.CharField(max_length=120)
    customer_phone = models.CharField(max_length=30)
    delivery_address = models.CharField(max_length=255, blank=True)
    admin_note = models.TextField(blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='TZS')
    status = models.CharField(
        max_length=20,
        choices=QuickOrderStatus.choices,
        default=QuickOrderStatus.NEW
    )
    delivered_at = models.DateTimeField(null=True, blank=True)
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Exactly what the customer paid, recorded when the order is closed')
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_quick_orders'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_quick_orders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quick_orders'
        verbose_name = _('quick order')
        verbose_name_plural = _('quick orders')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'status']),
            models.Index(fields=['customer_phone']),
        ]

    def __str__(self):
        return f"{self.customer_name} - {self.quantity}x {self.listing.title}"


class PurchaseOrderStatus(models.TextChoices):
    SENT = 'sent', _('Sent to store')
    ACCEPTED = 'accepted', _('Accepted by store')
    READY = 'ready', _('Ready for pickup')
    PICKED_UP = 'picked_up', _('Picked up')
    REJECTED = 'rejected', _('Rejected by store')
    CANCELLED = 'cancelled', _('Cancelled')


class PurchaseOrderPaymentStatus(models.TextChoices):
    UNPAID = 'unpaid', _('Unpaid')
    PAID = 'paid', _('Paid (confirmed by store)')


class PriceStatus(models.TextChoices):
    """Where the price negotiation between Mo Expressway and the store stands."""
    OFFERED = 'offered', _('Offered by Mo Expressway - store to accept')
    AWAITING_QUOTE = 'awaiting_quote', _('Waiting for the store to quote')
    VENDOR_PROPOSED = 'vendor_proposed', _('Store proposed a price - admin to respond')
    AGREED = 'agreed', _('Agreed')


ACTIVE_PURCHASE_ORDER_STATUSES = (
    PurchaseOrderStatus.SENT,
    PurchaseOrderStatus.ACCEPTED,
    PurchaseOrderStatus.READY,
)


class StorePurchaseOrder(models.Model):
    """
    An order the platform (Mo Expressway) places with a store to fulfil a
    customer order. The platform is the buyer: the store sees the product,
    quantity and price only, never the end customer's details.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po_number = models.CharField(max_length=30, unique=True)
    customer_order = models.ForeignKey(
        QuickOrder,
        on_delete=models.PROTECT,
        related_name='purchase_orders',
        help_text=_('Internal link - never exposed to the vendor')
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )
    listing = models.ForeignKey(
        'catalog.Listing',
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )
    listing_title_snapshot = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text=_('Price the platform pays the store per unit')
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='TZS')
    status = models.CharField(
        max_length=20,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.SENT
    )
    price_status = models.CharField(
        max_length=20,
        choices=PriceStatus.choices,
        default=PriceStatus.OFFERED,
    )
    vendor_quote = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Total price the store proposed for this order')
    )
    vendor_quote_note = models.TextField(blank=True)
    quoted_at = models.DateTimeField(null=True, blank=True)
    payment_status = models.CharField(
        max_length=10,
        choices=PurchaseOrderPaymentStatus.choices,
        default=PurchaseOrderPaymentStatus.UNPAID,
        help_text=_('The store confirms it has been paid before the goods can be picked up')
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    amount_received = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Amount the store says it received when marking the order as paid')
    )
    vendor_note = models.TextField(blank=True)
    admin_note = models.TextField(
        blank=True,
        help_text=_('Internal note - not visible to the vendor')
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_purchase_orders'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_purchase_orders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'store_purchase_orders'
        verbose_name = _('store purchase order')
        verbose_name_plural = _('store purchase orders')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'status']),
            models.Index(fields=['customer_order']),
        ]

    def __str__(self):
        return f"{self.po_number} - {self.store.name}"
