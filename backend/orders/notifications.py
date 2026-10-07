"""Order email notifications.

Admins are told about everything (including customer details). Vendors are
only ever told about purchase orders placed with their store - never who the
end customer is.

Emails are sent after the database transaction commits and, by default, in a
background thread so a slow or failing SMTP server never blocks or breaks an
order. Failures are logged, not raised.
"""

import logging
import threading

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail.message import EmailMultiAlternatives
from django.db import transaction
from django.db.models import Q
from django.template.loader import render_to_string
from django.utils import timezone

from auths.models import UserRole

logger = logging.getLogger(__name__)

# Name shown to vendors as the buyer on every purchase order.
PLATFORM_BUYER_NAME = "Mo Expressway"


def _money(currency, amount):
    return f"{currency} {amount:,.0f}"


def admin_recipients():
    """Where admin order emails go.

    ORDER_NOTIFY_EMAILS (from .env) wins when set - only those addresses are
    used. Otherwise fall back to every active admin account with an email.
    """
    configured = [e.strip().lower() for e in getattr(settings, "ORDER_NOTIFY_EMAILS", []) if e.strip()]
    if configured:
        return sorted(set(configured))

    User = get_user_model()
    emails = (
        User.objects.filter(is_active=True)
        .filter(Q(role=UserRole.ADMIN) | Q(is_staff=True) | Q(is_superuser=True))
        .exclude(email__isnull=True)
        .exclude(email="")
        .values_list("email", flat=True)
    )
    return sorted({e.strip().lower() for e in emails if e.strip()})


def _vendor_recipients(store):
    owner = store.owner
    if owner and owner.is_active and owner.email:
        return [owner.email]
    return []


def _deliver(messages):
    for message in messages:
        try:
            message.send(using="default")
        except Exception:
            logger.exception("Failed to send order email %r to %s", message.subject, message.to)


def _send(to, subject, heading, intro, rows, button_label="", path="", preheader=""):
    """Build the email now; send it once the current transaction commits."""
    if not to:
        return
    link = f"{settings.FRONTEND_URL}{path}" if path else ""
    context = {
        "heading": heading,
        "intro": intro,
        "rows": rows,
        "button_label": button_label,
        "link": link,
        "preheader": preheader or intro,
        "year": timezone.now().year,
    }
    text_lines = [heading, "", intro, ""]
    text_lines += [f"{label}: {value}" for label, value in rows]
    if link:
        text_lines += ["", f"{button_label}: {link}"]
    # One email per recipient so addresses are never exposed to each other.
    messages = []
    html = render_to_string("orders/order_email.html", context)
    for address in to:
        message = EmailMultiAlternatives(
            subject=subject,
            body="\n".join(text_lines),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[address],
        )
        message.attach_alternative(html, "text/html")
        messages.append(message)

    def dispatch():
        if getattr(settings, "ORDER_EMAILS_ASYNC", True):
            threading.Thread(target=_deliver, args=(messages,), daemon=True).start()
        else:
            _deliver(messages)

    transaction.on_commit(dispatch)


# ---------------------------------------------------------------------------
# Admin notifications
# ---------------------------------------------------------------------------

def notify_admins_new_customer_order(order):
    rows = [
        ("Product", f"{order.quantity}x {order.listing.title}"),
        ("Customer pays", _money(order.currency, order.total_amount)),
        ("Customer", order.customer_name),
        ("Phone", order.customer_phone),
    ]
    if order.delivery_address:
        rows.append(("Delivery location", order.delivery_address))
    rows.append(("Listed by", order.store.name))
    _send(
        admin_recipients(),
        subject=f"New order: {order.quantity}x {order.listing.title} - {order.customer_name}",
        heading="New customer order",
        intro="A customer just placed an order. Call them to confirm, then buy it from a store.",
        rows=rows,
        button_label="Open orders",
        path="/admin/orders",
    )


def notify_admins_customer_cancelled(order):
    _send(
        admin_recipients(),
        subject=f"Order cancelled by customer: {order.customer_name}",
        heading="Customer cancelled an order",
        intro=f"{order.customer_name} cancelled their order.",
        rows=[
            ("Product", f"{order.quantity}x {order.listing.title}"),
            ("Customer", order.customer_name),
            ("Phone", order.customer_phone),
        ],
        button_label="Open orders",
        path="/admin/orders",
    )


_VENDOR_EVENT_COPY = {
    "accepted": ("accepted", "The store accepted the purchase order. Pay the store so it can mark the order as paid."),
    "ready": ("marked ready", "The items are ready at the store."),
    "rejected": ("rejected", "The store rejected the purchase order. Choose another store for this customer order."),
    "paid": ("confirmed payment for", "The store confirmed it received payment. The items can now be picked up."),
}


def notify_admins_vendor_update(po, event):
    verb, intro = _VENDOR_EVENT_COPY[event]
    order = po.customer_order
    rows = [
        ("Purchase order", po.po_number),
        ("Store", po.store.name),
        ("Product", f"{po.quantity}x {po.listing_title_snapshot}"),
        ("We pay", _money(po.currency, po.total_amount)),
        ("For customer", f"{order.customer_name} ({order.customer_phone})"),
    ]
    if event == "paid" and po.amount_received is not None:
        received = _money(po.currency, po.amount_received)
        if po.amount_received != po.total_amount:
            difference = _money(po.currency, po.amount_received - po.total_amount)
            received = f"{received} (does not match agreed total; difference {difference})"
        rows.append(("Store received", received))
    if po.vendor_note:
        rows.append(("Store note", po.vendor_note))
    _send(
        admin_recipients(),
        subject=f"{po.store.name} {verb} {po.po_number}",
        heading=f"Store {verb} {po.po_number}",
        intro=intro,
        rows=rows,
        button_label="Open orders",
        path="/admin/orders",
    )


# ---------------------------------------------------------------------------
# Vendor notifications - purchase order details only, never the customer
# ---------------------------------------------------------------------------

def _po_rows(po):
    rows = [
        ("Order number", po.po_number),
        ("Buyer", PLATFORM_BUYER_NAME),
        ("Product", po.listing_title_snapshot),
        ("Quantity", str(po.quantity)),
    ]
    if po.price_status == "awaiting_quote":
        rows.append(("Price", "Waiting for your quote"))
    else:
        label = "Agreed" if po.price_status == "agreed" else "Offered"
        rows += [
            (f"{label} unit price", _money(po.currency, po.unit_price)),
            (f"{label} total", _money(po.currency, po.total_amount)),
        ]
    return rows


def notify_vendor_new_purchase_order(po):
    if po.price_status == "awaiting_quote":
        intro = (
            f"{PLATFORM_BUYER_NAME} wants to book {po.store.name}. "
            "Please send your price for this job from your Orders page."
        )
    else:
        intro = (
            f"{PLATFORM_BUYER_NAME} wants to buy from {po.store.name}. "
            "Accept the offered price or propose your own, then prepare the order "
            "and mark it as paid once you receive payment."
        )
    _send(
        _vendor_recipients(po.store),
        subject=f"New order {po.po_number} from {PLATFORM_BUYER_NAME}",
        heading="You have a new order",
        intro=intro,
        rows=_po_rows(po),
        button_label="View order",
        path="/vendor/orders",
    )


def notify_vendor_quote_accepted(po):
    _send(
        _vendor_recipients(po.store),
        subject=f"Your price for {po.po_number} was accepted",
        heading="Price accepted",
        intro=(
            f"{PLATFORM_BUYER_NAME} accepted your price of {_money(po.currency, po.total_amount)}. "
            "The order is confirmed - please prepare it."
        ),
        rows=_po_rows(po),
        button_label="View order",
        path="/vendor/orders",
    )


def notify_admins_vendor_quote(po):
    order = po.customer_order
    rows = [
        ("Purchase order", po.po_number),
        ("Store", po.store.name),
        ("Item", f"{po.quantity}x {po.listing_title_snapshot}"),
        ("Store's price", _money(po.currency, po.vendor_quote)),
    ]
    if po.total_amount:  # zero when we asked the store to quote
        rows.append(("Our offer was", _money(po.currency, po.total_amount)))
    if po.vendor_quote_note:
        rows.append(("Store note", po.vendor_quote_note))
    rows += [
        ("Customer pays", _money(order.currency, order.total_amount) if order.total_amount else "Price not set yet"),
        ("For customer", f"{order.customer_name} ({order.customer_phone})"),
    ]
    _send(
        admin_recipients(),
        subject=f"{po.store.name} sent a price for {po.po_number}",
        heading="Store sent its price",
        intro="Accept the store's price, or counter-offer with a different price.",
        rows=rows,
        button_label="Open orders",
        path="/admin/orders",
    )


def notify_vendor_price_changed(po, old_total):
    _send(
        _vendor_recipients(po.store),
        subject=f"New price offer on order {po.po_number}",
        heading="New price offer",
        intro=(
            f"{PLATFORM_BUYER_NAME} offers {_money(po.currency, po.total_amount)} for this order"
            + (f" (was {_money(po.currency, old_total)})" if old_total else "")
            + ". Please accept it or propose your own price."
        ),
        rows=_po_rows(po),
        button_label="View order",
        path="/vendor/orders",
    )


def notify_vendor_purchase_order_cancelled(po):
    _send(
        _vendor_recipients(po.store),
        subject=f"Order {po.po_number} cancelled",
        heading="An order was cancelled",
        intro=f"{PLATFORM_BUYER_NAME} cancelled this order. You don't need to prepare it.",
        rows=_po_rows(po),
        button_label="View orders",
        path="/vendor/orders",
    )


def notify_vendor_picked_up(po):
    _send(
        _vendor_recipients(po.store),
        subject=f"Order {po.po_number} collected",
        heading="Order collected",
        intro=f"Our rider collected order {po.po_number}. Thank you!",
        rows=_po_rows(po),
        button_label="View orders",
        path="/vendor/orders",
    )
