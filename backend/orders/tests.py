import json

from django.core import mail
from django.test import TestCase, override_settings

from auths.models import User, UserRole
from catalog.models import Listing, ProductCategory
from stores.models import Store, StoreCategory, StoreStatus

from .models import PurchaseOrderStatus, QuickOrder, QuickOrderStatus, StorePurchaseOrder


class PlatformBuyerFlowTests(TestCase):
    """Customer -> admin -> store purchase order -> pickup -> delivery,
    with the store never seeing the customer's details."""

    def setUp(self):
        self.admin = User.objects.create_user("+255700000001", "pw", role=UserRole.ADMIN)
        self.vendor = User.objects.create_user("+255700000002", "pw", role=UserRole.VENDOR_OWNER)
        self.other_vendor = User.objects.create_user("+255700000003", "pw", role=UserRole.VENDOR_OWNER)

        store_cat = StoreCategory.objects.create(name="Electronics")
        product_cat = ProductCategory.objects.create(name="Phones")
        self.store = Store.objects.create(
            owner=self.vendor, name="Kariakoo Phones", category=store_cat, status=StoreStatus.APPROVED
        )
        self.other_store = Store.objects.create(
            owner=self.other_vendor, name="Mlimani Gadgets", category=store_cat, status=StoreStatus.APPROVED
        )
        self.listing = Listing.objects.create(
            store=self.store, category=product_cat, title="Samsung Galaxy A15",
            description="Phone", price="450000",
        )
        self.cheaper = Listing.objects.create(
            store=self.other_store, category=product_cat, title="Samsung Galaxy A15 128GB",
            description="Phone", price="420000",
        )

    def _json(self, method, url, user=None, body=None):
        if user:
            self.client.force_login(user)
        else:
            self.client.logout()
        if method == "get":
            return self.client.get(url)
        return getattr(self.client, method)(
            url, data=json.dumps(body or {}), content_type="application/json"
        )

    def _place_customer_order(self):
        res = self._json("post", "/api/orders/quick/", body={
            "listing_id": str(self.listing.pk), "quantity": 2,
            "name": "Amina Juma", "phone": "0712345678", "address": "Sinza, Dar",
        })
        self.assertEqual(res.status_code, 201)
        self.assertNotIn("store", res.json())
        return res.json()["order_id"]

    def test_full_flow_hides_customer_from_vendor(self):
        order_id = self._place_customer_order()

        # Vendor sees nothing until the admin buys from them.
        res = self._json("get", "/api/vendor/orders/", self.vendor)
        self.assertEqual(res.json()["orders"], [])

        # Admin sees the customer and sourcing options, original listing first.
        res = self._json("get", "/api/admin/orders/", self.admin)
        self.assertEqual(res.json()["orders"][0]["customer_phone"], "0712345678")
        res = self._json("get", f"/api/admin/orders/{order_id}/sourcing/", self.admin)
        options = res.json()["options"]
        self.assertEqual(options[0]["listing_id"], str(self.listing.pk))
        self.assertIn(str(self.cheaper.pk), [o["listing_id"] for o in options])

        # Admin buys from the cheaper store at a negotiated price.
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.cheaper.pk), "unit_price": "415000"})
        self.assertEqual(res.status_code, 201)
        order = res.json()["order"]
        self.assertEqual(order["status"], QuickOrderStatus.SOURCING)
        self.assertEqual(order["margin"], "70000.00")
        po_id = res.json()["purchase_order_id"]

        # The chosen vendor sees the PO with Mo Expressway as buyer - no customer data -
        # and the negotiated price next to its usual listing price.
        res = self._json("get", "/api/vendor/orders/", self.other_vendor)
        po = res.json()["orders"][0]
        self.assertEqual(po["buyer"], "Mo Expressway")
        self.assertEqual(po["unit_price"], "415000.00")
        self.assertEqual(po["listing_price"], "420000.00")
        self.assertEqual(po["total"], "830000.00")
        raw = json.dumps(res.json())
        for secret in ("Amina", "0712345678", "Sinza", order_id):
            self.assertNotIn(secret, raw)
        # ...and the other vendor sees nothing.
        self.assertEqual(self._json("get", "/api/vendor/orders/", self.vendor).json()["orders"], [])

        # Vendor cannot skip steps.
        res = self._json("patch", "/api/vendor/orders/", self.other_vendor, {"order_id": po_id, "status": "picked_up"})
        self.assertEqual(res.status_code, 400)

        for status in ("accepted", "ready"):
            res = self._json("patch", "/api/vendor/orders/", self.other_vendor, {"order_id": po_id, "status": status})
            self.assertEqual(res.status_code, 200, res.content)

        # Pickup is blocked until the store confirms it has been paid.
        res = self._json("patch", f"/api/admin/purchase-orders/{po_id}/", self.admin, {"status": "picked_up"})
        self.assertEqual(res.status_code, 400)
        # The store must say how much it received.
        res = self._json("patch", "/api/vendor/orders/", self.other_vendor,
                         {"order_id": po_id, "payment_status": "paid"})
        self.assertEqual(res.status_code, 400)
        res = self._json("patch", "/api/vendor/orders/", self.other_vendor,
                         {"order_id": po_id, "payment_status": "paid", "amount_received": "800,000"})
        self.assertEqual(res.json()["order"]["payment_status"], "paid")
        self.assertEqual(res.json()["order"]["amount_received"], "800000.00")
        admin_po = self._json("get", "/api/admin/orders/", self.admin).json()["orders"][0]["purchase_orders"][0]
        self.assertEqual(admin_po["amount_received"], "800000.00")
        # A paid order can no longer be rejected by the store.
        res = self._json("patch", "/api/vendor/orders/", self.other_vendor,
                         {"order_id": po_id, "status": "rejected"})
        self.assertEqual(res.status_code, 400)

        # Admin collects and delivers.
        res = self._json("patch", f"/api/admin/purchase-orders/{po_id}/", self.admin, {"status": "picked_up"})
        self.assertEqual(res.json()["order"]["status"], QuickOrderStatus.PICKED_UP)
        res = self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"status": "delivered"})
        self.assertEqual(res.json()["order"]["status"], QuickOrderStatus.DELIVERED)

        dash = self._json("get", "/api/vendor/dashboard/", self.other_vendor).json()
        self.assertEqual(dash["summary"]["total_sales"], "800000.00")

        self.assertEqual(self.client.get(f"/api/orders/quick/{order_id}/").json()["status"], "delivered")

    def test_rejection_returns_order_to_admin_queue(self):
        order_id = self._place_customer_order()
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.listing.pk)})
        po_id = res.json()["purchase_order_id"]

        # Only one active purchase order at a time.
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.cheaper.pk)})
        self.assertEqual(res.status_code, 400)

        self._json("patch", "/api/vendor/orders/", self.vendor,
                   {"order_id": po_id, "status": "rejected", "note": "Out of stock"})
        self.assertEqual(QuickOrder.objects.get(pk=order_id).status, QuickOrderStatus.CONFIRMED)

        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.cheaper.pk)})
        self.assertEqual(res.status_code, 201)

    def test_cancelling_customer_order_cancels_store_po(self):
        order_id = self._place_customer_order()
        self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                   {"listing_id": str(self.listing.pk)})
        res = self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"status": "cancelled"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            StorePurchaseOrder.objects.get(customer_order_id=order_id).status,
            PurchaseOrderStatus.CANCELLED,
        )

    def test_vendor_cannot_mark_paid_before_accepting(self):
        order_id = self._place_customer_order()
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.listing.pk)})
        po_id = res.json()["purchase_order_id"]
        res = self._json("patch", "/api/vendor/orders/", self.vendor,
                         {"order_id": po_id, "payment_status": "paid"})
        self.assertEqual(res.status_code, 400)

    def test_subscription_plans(self):
        from subscriptions.models import SubscriptionInvoice
        from subscriptions.views import _current_month

        # Free stores cannot be billed and the vendor sees their plan.
        res = self._json("post", "/api/admin/revenue/", self.admin, {
            "month": _current_month().isoformat(),
            "entries": [{"store_id": str(self.store.pk), "amount": "20000"}],
        })
        self.assertEqual(res.status_code, 400)
        sub = self._json("get", "/api/vendor/dashboard/", self.vendor).json()["subscription"]
        self.assertEqual(sub["plan"], "free")

        # Admin switches the store to monthly; it can now be billed.
        res = self._json("patch", f"/api/admin/revenue/stores/{self.store.pk}/plan/", self.admin,
                         {"plan": "monthly", "monthly_fee": "25000"})
        self.assertEqual(res.status_code, 200, res.content)
        res = self._json("post", "/api/admin/revenue/", self.admin, {
            "month": _current_month().isoformat(),
            "entries": [{"store_id": str(self.store.pk), "amount": "25000"}],
        })
        self.assertEqual(res.status_code, 200)
        dash = self._json("get", "/api/vendor/dashboard/", self.vendor).json()
        self.assertEqual(dash["subscription"]["plan"], "monthly")
        self.assertEqual(dash["subscription"]["monthly_fee"], "25000.00")
        self.assertEqual(dash["subscription"]["status"], "unpaid")
        self.assertEqual(dash["summary"]["platform_subscription"], "Monthly plan")

        # Unpaid monthly store is hidden; switching to free makes it visible again.
        def visible():
            res = self.client.get("/api/catalog/")
            return str(self.listing.pk) in res.content.decode()
        self.assertFalse(visible())
        self._json("patch", f"/api/admin/revenue/stores/{self.store.pk}/plan/", self.admin, {"plan": "free"})
        self.assertTrue(visible())
        self.assertEqual(SubscriptionInvoice.objects.filter(store=self.store).count(), 1)

        # Vendors cannot change plans.
        res = self._json("patch", f"/api/admin/revenue/stores/{self.store.pk}/plan/", self.vendor, {"plan": "free"})
        self.assertEqual(res.status_code, 403)

    @override_settings(ORDER_EMAILS_ASYNC=False, ORDER_NOTIFY_EMAILS=[])
    def test_order_emails(self):
        self.admin.email = "boss@example.com"
        self.admin.save()
        self.other_vendor.email = "gadgets@example.com"
        self.other_vendor.save()

        def emails_during(fn):
            mail.outbox.clear()
            with self.captureOnCommitCallbacks(execute=True):
                result = fn()
            return result, list(mail.outbox)

        # New customer order -> admin only, with customer details.
        order_id, sent = emails_during(self._place_customer_order)
        self.assertEqual([m.to for m in sent], [["boss@example.com"]])
        self.assertIn("0712345678", sent[0].body)

        # Purchase order -> vendor only, with NO customer details.
        res, sent = emails_during(lambda: self._json(
            "post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
            {"listing_id": str(self.cheaper.pk)},
        ))
        po_id = res.json()["purchase_order_id"]
        self.assertEqual([m.to for m in sent], [["gadgets@example.com"]])
        vendor_mail = sent[0]
        content = vendor_mail.body + vendor_mail.alternatives[0].content
        self.assertIn("Mo Expressway", content)
        for secret in ("Amina", "0712345678", "Sinza"):
            self.assertNotIn(secret, content)

        # Vendor accepts and confirms payment -> admin is told each time.
        _, sent = emails_during(lambda: self._json(
            "patch", "/api/vendor/orders/", self.other_vendor, {"order_id": po_id, "status": "accepted"}))
        self.assertEqual([m.to for m in sent], [["boss@example.com"]])
        _, sent = emails_during(lambda: self._json(
            "patch", "/api/vendor/orders/", self.other_vendor,
            {"order_id": po_id, "payment_status": "paid", "amount_received": "400000"}))
        self.assertIn("payment", sent[0].subject.lower() + sent[0].body.lower())
        self.assertIn("does not match", sent[0].body)

        # Admin cancels the customer order -> vendor learns its PO is cancelled.
        _, sent = emails_during(lambda: self._json(
            "patch", f"/api/admin/orders/{order_id}/", self.admin, {"status": "cancelled"}))
        self.assertEqual([m.to for m in sent], [["gadgets@example.com"]])
        self.assertIn("cancelled", sent[0].subject.lower())

    @override_settings(ORDER_EMAILS_ASYNC=False, ORDER_NOTIFY_EMAILS=["Owner@Example.com"])
    def test_configured_email_replaces_admin_accounts(self):
        self.admin.email = "boss@example.com"
        self.admin.save()
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            self._place_customer_order()
        self.assertEqual([m.to for m in mail.outbox], [["owner@example.com"]])

    def test_admin_changes_negotiated_price(self):
        order_id = self._place_customer_order()
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.listing.pk)})
        po_id = res.json()["purchase_order_id"]

        res = self._json("patch", f"/api/admin/purchase-orders/{po_id}/", self.admin, {"unit_price": "430,000"})
        self.assertEqual(res.status_code, 200, res.content)
        po = self._json("get", "/api/vendor/orders/", self.vendor).json()["orders"][0]
        self.assertEqual((po["unit_price"], po["total"], po["listing_price"]),
                         ("430000.00", "860000.00", "450000.00"))

        # Locked once the store confirms payment.
        self._json("patch", "/api/vendor/orders/", self.vendor, {"order_id": po_id, "status": "accepted"})
        self._json("patch", "/api/vendor/orders/", self.vendor,
                   {"order_id": po_id, "payment_status": "paid", "amount_received": "860000"})
        res = self._json("patch", f"/api/admin/purchase-orders/{po_id}/", self.admin, {"unit_price": "1"})
        self.assertEqual(res.status_code, 400)

    @override_settings(ORDER_EMAILS_ASYNC=False, ORDER_NOTIFY_EMAILS=["owner@example.com"])
    def test_admin_deletes_order_with_purchase_orders(self):
        self.vendor.email = "kariakoo@example.com"
        self.vendor.save()
        order_id = self._place_customer_order()
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.listing.pk)})
        po_id = res.json()["purchase_order_id"]

        # Vendors cannot delete.
        self.assertEqual(self._json("delete", f"/api/admin/orders/{order_id}/", self.vendor).status_code, 403)

        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            res = self._json("delete", f"/api/admin/orders/{order_id}/", self.admin)
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse(QuickOrder.objects.filter(pk=order_id).exists())
        self.assertFalse(StorePurchaseOrder.objects.filter(pk=po_id).exists())
        self.assertEqual(self._json("get", "/api/vendor/orders/", self.vendor).json()["orders"], [])
        self.assertEqual([m.to for m in mail.outbox], [["kariakoo@example.com"]])

    def test_service_booking_price_negotiation(self):
        order_id = self._place_customer_order()

        # Admin sets what the customer pays once the job is understood.
        res = self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"customer_total": "1,000,000"})
        self.assertEqual(res.json()["order"]["total"], "1000000.00")

        # Book the provider without a price - ask for a quote. Margin is unknown.
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.listing.pk), "request_quote": True})
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(res.json()["order"]["margin"])
        po_id = res.json()["purchase_order_id"]
        po = self._json("get", "/api/vendor/orders/", self.vendor).json()["orders"][0]
        self.assertEqual(po["price_status"], "awaiting_quote")

        # The store cannot accept before a price exists; it sends its quote instead.
        res = self._json("patch", "/api/vendor/orders/", self.vendor, {"order_id": po_id, "status": "accepted"})
        self.assertEqual(res.status_code, 400)
        res = self._json("patch", "/api/vendor/orders/", self.vendor,
                         {"order_id": po_id, "quote": "950000", "note": "Big job, 2 days"})
        self.assertEqual(res.json()["order"]["price_status"], "vendor_proposed")

        # Admin counter-offers; the store must accept the new offer.
        res = self._json("patch", f"/api/admin/purchase-orders/{po_id}/", self.admin, {"unit_price": "450000"})
        self.assertEqual(res.status_code, 200)
        po = self._json("get", "/api/vendor/orders/", self.vendor).json()["orders"][0]
        self.assertEqual((po["price_status"], po["total"]), ("offered", "900000.00"))

        # Store counters again; admin accepts the store's price -> accepted.
        self._json("patch", "/api/vendor/orders/", self.vendor, {"order_id": po_id, "quote": "920000"})
        res = self._json("patch", f"/api/admin/purchase-orders/{po_id}/", self.admin, {"accept_quote": True})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["order"]["margin"], "80000.00")
        po = self._json("get", "/api/vendor/orders/", self.vendor).json()["orders"][0]
        self.assertEqual((po["status"], po["price_status"], po["total"]), ("accepted", "agreed", "920000.00"))

        # Once agreed and accepted, the store can no longer re-quote.
        res = self._json("patch", "/api/vendor/orders/", self.vendor, {"order_id": po_id, "quote": "1"})
        self.assertEqual(res.status_code, 400)

    def test_customer_choice_from_pending_store_can_be_booked(self):
        """What customers can order, the admin can buy from the same store."""
        self.store.status = StoreStatus.PENDING
        self.store.save()
        order_id = self._place_customer_order()  # public ordering allows pending stores

        options = self._json("get", f"/api/admin/orders/{order_id}/sourcing/", self.admin).json()
        first = options["options"][0]
        self.assertTrue(first["is_original"])
        self.assertEqual(first["store_status"], "pending")
        self.assertIsNone(options["original_unavailable"])

        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.listing.pk)})
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(self._json("get", "/api/vendor/orders/", self.vendor).json()["orders"]), 1)

    def test_admin_told_when_customer_choice_unavailable(self):
        order_id = self._place_customer_order()
        self.store.status = StoreStatus.SUSPENDED
        self.store.save()
        options = self._json("get", f"/api/admin/orders/{order_id}/sourcing/", self.admin).json()
        self.assertNotIn(str(self.listing.pk), [o["listing_id"] for o in options["options"]])
        self.assertEqual(options["original_unavailable"]["store"], "Kariakoo Phones")
        self.assertIn("suspended", options["original_unavailable"]["reason"])

    def test_monthly_finance_summary(self):
        from subscriptions.models import SubscriptionInvoice
        from subscriptions.views import _current_month

        # Customer pays 900,000; we pay the store 830,000 (store says it received 800,000).
        order_id = self._place_customer_order()
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.cheaper.pk), "unit_price": "415000"})
        po_id = res.json()["purchase_order_id"]
        self._json("patch", "/api/vendor/orders/", self.other_vendor, {"order_id": po_id, "status": "accepted"})
        self._json("patch", "/api/vendor/orders/", self.other_vendor,
                   {"order_id": po_id, "payment_status": "paid", "amount_received": "800000"})

        month = _current_month().strftime("%Y-%m")
        summary = self._json("get", f"/api/admin/finance/?month={month}", self.admin).json()["summary"]
        # Paid to the store already counts; the order isn't delivered so no customer money yet.
        self.assertEqual(summary["paid_to_vendors"], "800000.00")
        self.assertEqual(summary["received_from_customers"], "0")
        self.assertEqual(summary["delivered_orders"], 0)

        self._json("patch", f"/api/admin/purchase-orders/{po_id}/", self.admin, {"status": "picked_up"})
        self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"status": "delivered"})
        # Delivered but not closed: no customer money counted yet.
        pending = self._json("get", f"/api/admin/finance/?month={month}", self.admin).json()["summary"]
        self.assertEqual((pending["received_from_customers"], pending["awaiting_close"]), ("0", 1))
        self._json("patch", f"/api/admin/orders/{order_id}/", self.admin,
                   {"status": "closed", "amount_paid": "900000"})
        SubscriptionInvoice.objects.create(
            store=self.store, period_month=_current_month(), amount="25000", status="paid"
        )

        data = self._json("get", f"/api/admin/finance/?month={month}", self.admin).json()
        s = data["summary"]
        self.assertEqual(s["received_from_customers"], "900000.00")
        self.assertEqual(s["order_profit"], "100000.00")
        self.assertEqual(s["subscription_income"], "25000.00")
        self.assertEqual(s["total_revenue"], "125000.00")
        self.assertEqual(data["orders"][0]["stores"], ["Mlimani Gadgets"])

        # Another month is empty; vendors are forbidden.
        empty = self._json("get", "/api/admin/finance/?month=2020-01", self.admin).json()["summary"]
        self.assertEqual(empty["total_revenue"], "0")
        self.assertEqual(self._json("get", "/api/admin/finance/", self.vendor).status_code, 403)

    def test_closing_records_exact_amount_customer_paid(self):
        from subscriptions.views import _current_month

        order_id = self._place_customer_order()  # starting price 900,000
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.listing.pk), "unit_price": "470000"})
        po_id = res.json()["purchase_order_id"]
        self._json("patch", "/api/vendor/orders/", self.vendor, {"order_id": po_id, "status": "accepted"})
        self._json("patch", "/api/vendor/orders/", self.vendor,
                   {"order_id": po_id, "payment_status": "paid", "amount_received": "940000"})
        self._json("patch", f"/api/admin/purchase-orders/{po_id}/", self.admin, {"status": "picked_up"})

        # Can't close before delivery, nor close without the amount.
        res = self._json("patch", f"/api/admin/orders/{order_id}/", self.admin,
                         {"status": "closed", "amount_paid": "1000000"})
        self.assertEqual(res.status_code, 400)
        self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"status": "delivered"})
        res = self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"status": "closed"})
        self.assertEqual(res.status_code, 400)
        # A delivered order can't go anywhere but closed.
        res = self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"status": "cancelled"})
        self.assertEqual(res.status_code, 400)

        res = self._json("patch", f"/api/admin/orders/{order_id}/", self.admin,
                         {"status": "closed", "amount_paid": "1,000,000"})
        order = res.json()["order"]
        self.assertEqual((order["status"], order["amount_paid"], order["margin"]),
                         ("closed", "1000000.00", "60000.00"))
        month = _current_month().strftime("%Y-%m")
        s = self._json("get", f"/api/admin/finance/?month={month}", self.admin).json()["summary"]
        self.assertEqual((s["received_from_customers"], s["order_profit"], s["awaiting_close"]),
                         ("1000000.00", "60000.00", 0))

        # The customer still just sees "delivered".
        self.assertEqual(self.client.get(f"/api/orders/quick/{order_id}/").json()["status"], "delivered")

        # A wrong amount can be corrected on the closed order; agreed price is locked.
        self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"amount_paid": "990000"})
        s = self._json("get", f"/api/admin/finance/?month={month}", self.admin).json()["summary"]
        self.assertEqual(s["order_profit"], "50000.00")
        res = self._json("patch", f"/api/admin/orders/{order_id}/", self.admin, {"customer_total": "1"})
        self.assertEqual(res.status_code, 400)

    def test_admin_dashboard(self):
        order_id = self._place_customer_order()
        res = self._json("post", f"/api/admin/orders/{order_id}/purchase-orders/", self.admin,
                         {"listing_id": str(self.listing.pk)})
        po_id = res.json()["purchase_order_id"]
        self._json("patch", "/api/vendor/orders/", self.vendor, {"order_id": po_id, "status": "accepted"})

        data = self._json("get", "/api/admin/dashboard/", self.admin).json()
        cards = data["cards"]
        self.assertEqual(cards["stores_total"], 2)
        self.assertEqual(cards["customers"], 1)
        self.assertEqual(cards["orders_this_month"], 1)
        self.assertEqual(cards["orders_at_stores"], 1)
        # Accepted but not paid yet -> we owe the store the agreed total.
        self.assertEqual(cards["owed_to_vendors"], "900000.00")
        self.assertEqual(len(data["stats"]["monthly"]), 6)
        self.assertEqual(sum(d["orders"] for d in data["stats"]["daily_orders"]), 1)
        self.assertEqual(
            {s["status"]: s["orders"] for s in data["stats"]["orders_by_status"]}["sourcing"], 1
        )
        self.assertEqual(self._json("get", "/api/admin/dashboard/", self.vendor).status_code, 403)

    def test_vendor_cannot_touch_admin_endpoints(self):
        order_id = self._place_customer_order()
        self.assertEqual(self._json("get", "/api/admin/orders/", self.vendor).status_code, 403)
        self.assertEqual(
            self._json("get", f"/api/admin/orders/{order_id}/sourcing/", self.vendor).status_code, 403
        )
