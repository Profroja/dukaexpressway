import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserRole(models.TextChoices):
    CUSTOMER = 'customer', _('Customer')
    VENDOR_OWNER = 'vendor_owner', _('Vendor Owner')
    ADMIN = 'admin', _('Admin')
    DELIVERY_AGENT = 'delivery_agent', _('Delivery Agent')


class UserManager(BaseUserManager):
    """Custom user manager for phone number authentication"""

    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError(_('The Phone Number field must be set'))

        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_verified', True)
        extra_fields.setdefault('role', UserRole.ADMIN)

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))

        return self.create_user(phone_number, password, **extra_fields)


class User(AbstractUser):
    """Custom user model with phone number as USERNAME_FIELD"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    phone_number = models.CharField(
        _('phone number'),
        max_length=15,
        unique=True,
        help_text=_('Phone number in international format (e.g., +255712345678)')
    )
    email = models.EmailField(_('email address'), blank=True, null=True, unique=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER
    )
    is_verified = models.BooleanField(
        _('verified'),
        default=False,
        help_text=_('Designates whether this user has verified their phone number.')
    )
    email_verified = models.BooleanField(
        _('email verified'),
        default=False,
        help_text=_('Designates whether this user has verified their email address.')
    )
    created_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_users'
    )
    updated_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_users'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        verbose_name = _('user')
        verbose_name_plural = _('users')
        indexes = [
            models.Index(fields=['phone_number']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return self.phone_number


class EmailVerification(models.Model):
    """One-time token used to verify an email during vendor registration."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_('email address'), db_index=True)
    token = models.CharField(max_length=128, unique=True, db_index=True)
    is_verified = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'email_verifications'
        verbose_name = _('email verification')
        verbose_name_plural = _('email verifications')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'is_verified']),
        ]

    def __str__(self):
        return f"Verification for {self.email}"

    @property
    def is_expired(self):
        from django.utils import timezone

        return self.expires_at <= timezone.now()
