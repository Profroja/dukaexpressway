import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class DeliveryStatus(models.TextChoices):
    ASSIGNED = 'assigned', _('Assigned')
    PICKED_UP = 'picked_up', _('Picked Up')
    IN_TRANSIT = 'in_transit', _('In Transit')
    DELIVERED = 'delivered', _('Delivered')


class DeliveryAssignment(models.Model):
    """Delivery assignments for platform-managed delivery"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suborder = models.ForeignKey(
        'orders.SubOrder',
        on_delete=models.CASCADE,
        related_name='delivery_assignments'
    )
    delivery_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='delivery_assignments',
        limit_choices_to={'role': 'delivery_agent'}
    )
    status = models.CharField(
        max_length=15,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.ASSIGNED
    )
    picked_up_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_delivery_assignments'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_delivery_assignments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'delivery_assignments'
        verbose_name = _('delivery assignment')
        verbose_name_plural = _('delivery assignments')
        indexes = [
            models.Index(fields=['suborder']),
            models.Index(fields=['delivery_agent', 'status']),
        ]
    
    def __str__(self):
        return f"Delivery for {self.suborder} by {self.delivery_agent.phone_number}"
