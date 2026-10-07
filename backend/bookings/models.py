import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class ServiceBookingStatus(models.TextChoices):
    REQUESTED = 'requested', _('Requested')
    CONFIRMED = 'confirmed', _('Confirmed')
    IN_PROGRESS = 'in_progress', _('In Progress')
    COMPLETED = 'completed', _('Completed')
    CANCELLED = 'cancelled', _('Cancelled')


class ServiceBooking(models.Model):
    """Service bookings for service-type listings"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suborder = models.ForeignKey(
        'orders.SubOrder',
        on_delete=models.CASCADE,
        related_name='service_bookings'
    )
    listing = models.ForeignKey(
        'catalog.Listing',
        on_delete=models.PROTECT,
        related_name='bookings'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='service_bookings'
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.PROTECT,
        related_name='service_bookings'
    )
    scheduled_at = models.DateTimeField(
        help_text=_('Scheduled date and time for service')
    )
    status = models.CharField(
        max_length=15,
        choices=ServiceBookingStatus.choices,
        default=ServiceBookingStatus.REQUESTED
    )
    notes = models.TextField(
        blank=True,
        help_text=_('Additional notes or requirements')
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_service_bookings'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_service_bookings'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'service_bookings'
        verbose_name = _('service booking')
        verbose_name_plural = _('service bookings')
        ordering = ['scheduled_at']
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['store', 'status']),
            models.Index(fields=['scheduled_at']),
        ]
    
    def __str__(self):
        return f"Booking for {self.listing.title} - {self.scheduled_at.date()}"
