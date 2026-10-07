import json

from django.test import Client, TestCase

from .models import User, UserRole


class AdminPasswordResetTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("+255711000001", "AdminPass#2026", role=UserRole.ADMIN)
        self.vendor = User.objects.create_user(
            "+255711000002", "OldVendorPass#1", role=UserRole.VENDOR_OWNER, email="v@example.com"
        )
        self.url = f"/api/admin/users/{self.vendor.pk}/password/"

    def _post(self, client, url, body):
        return client.post(url, data=json.dumps(body), content_type="application/json")

    def _can_login(self, identifier, password):
        res = self._post(Client(), "/api/login/", {"email": identifier, "password": password})
        return res.status_code == 200

    def test_admin_sets_chosen_password(self):
        self.client.force_login(self.admin)
        res = self._post(self.client, self.url, {"password": "BrandNew#Pass9"})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(self._can_login("v@example.com", "BrandNew#Pass9"))
        self.assertFalse(self._can_login("v@example.com", "OldVendorPass#1"))

    def test_admin_generates_password(self):
        self.client.force_login(self.admin)
        res = self._post(self.client, self.url, {"generate": True})
        password = res.json()["password"]
        self.assertGreaterEqual(len(password), 10)
        self.assertTrue(self._can_login("+255711000002", password))

    def test_weak_password_rejected(self):
        self.client.force_login(self.admin)
        res = self._post(self.client, self.url, {"password": "12345"})
        self.assertEqual(res.status_code, 400)
        self.assertTrue(self._can_login("v@example.com", "OldVendorPass#1"))

    def test_reset_signs_user_out_everywhere(self):
        vendor_client = Client()
        vendor_client.force_login(self.vendor)
        self.assertEqual(vendor_client.get("/api/vendor/dashboard/").status_code, 400)  # logged in, no store

        self.client.force_login(self.admin)
        self._post(self.client, self.url, {"generate": True})
        self.assertEqual(vendor_client.get("/api/vendor/dashboard/").status_code, 401)

    def test_admin_resetting_own_password_stays_signed_in(self):
        self.client.force_login(self.admin)
        res = self._post(self.client, f"/api/admin/users/{self.admin.pk}/password/", {"generate": True})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 200)

    def test_non_admin_forbidden(self):
        self.client.force_login(self.vendor)
        res = self._post(self.client, f"/api/admin/users/{self.admin.pk}/password/", {"generate": True})
        self.assertEqual(res.status_code, 403)
