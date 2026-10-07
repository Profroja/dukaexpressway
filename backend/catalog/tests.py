import json
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from auths.models import EmailVerification
from stores.models import Store

from .models import Listing

# 1x1 transparent GIF
GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00"
    b"\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


@override_settings(MEDIA_ROOT="test-media-tmp")
class GoodsAndServicesStoreTests(TestCase):
    def _register(self, category_type, categories, email="both@example.com", phone="+255700111222"):
        EmailVerification.objects.create(
            email=email, token=f"tok-{email}", is_verified=True,
            expires_at=timezone.now() + timedelta(hours=1),
        )
        return self.client.post("/api/register/complete/", data=json.dumps({
            "token": f"tok-{email}",
            "full_name": "Asha Mussa",
            "phone_number": phone,
            "password": "StrongPass#2026",
            "store_name": "Asha Electronics & Repair",
            "category_type": category_type,
            "categories": categories,
            "latitude": -6.8, "longitude": 39.28,
        }), content_type="application/json")

    def _add(self, category_id, title, price=""):
        return self.client.post("/api/vendor/products/", data={
            "title": title, "price": price, "category_id": category_id,
            "image": SimpleUploadedFile("p.gif", GIF, content_type="image/gif"),
        })

    def test_both_requires_one_of_each(self):
        res = self._register("both", ["Electronics"])
        self.assertEqual(res.status_code, 400)
        self.assertIn("goods category and one services", res.json()["error"])
        self.assertFalse(Store.objects.exists())

    def test_store_selling_goods_and_services(self):
        res = self._register("both", ["Electronics", "Electronics Repair"])
        self.assertEqual(res.status_code, 200, res.content)
        store = Store.objects.get()
        self.assertEqual(store.category.name, "Goods & Services")
        self.assertEqual(store.listing_kind, "both")

        data = self.client.get("/api/vendor/products/").json()
        self.assertEqual(data["store"]["listing_type"], "both")
        options = {c["name"]: c for c in data["categories"]}
        self.assertEqual(set(options), {"Electronics", "Electronics Repair"})
        self.assertEqual(options["Electronics"]["listing_type"], "product")
        self.assertEqual(options["Electronics Repair"]["listing_type"], "service")

        # A product needs a price; a service may leave it blank.
        self.assertEqual(self._add(options["Electronics"]["id"], "Phone").status_code, 400)
        res = self._add(options["Electronics"]["id"], "Phone", "300000")
        self.assertEqual(res.json()["listing"]["listing_type"], "product")
        res = self._add(options["Electronics Repair"]["id"], "Screen repair")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["listing"]["listing_type"], "service")

        # Moving a listing to a service category turns it into a service.
        phone = Listing.objects.get(title="Phone")
        res = self.client.post("/api/vendor/products/", data={
            "id": str(phone.pk), "category_id": options["Electronics Repair"]["id"],
        })
        self.assertEqual(res.json()["listing"]["listing_type"], "service")

    def test_single_type_stores_unchanged(self):
        res = self._register("services", ["Cleaning"])
        self.assertEqual(res.status_code, 200, res.content)
        data = self.client.get("/api/vendor/products/").json()
        self.assertEqual(data["store"]["listing_type"], "service")
        sub = next(c for c in data["categories"] if c["name"] == "Cleaning")
        res = self._add(sub["id"], "Office cleaning")
        self.assertEqual(res.json()["listing"]["listing_type"], "service")

    @classmethod
    def tearDownClass(cls):
        import shutil
        shutil.rmtree("test-media-tmp", ignore_errors=True)
        super().tearDownClass()
