"""Backend tests for Proxy Panel API.

Covers auth, proxies CRUD, bulk import/export, health-check, API keys,
public /api/v1/active endpoint, and dashboard stats.
"""
from __future__ import annotations

import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://proxy-hub-27.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@proxy.com"
ADMIN_PASSWORD = "password"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Health/root ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_health(self, session):
        r = session.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200


# ---------- Auth ----------
class TestAuth:
    def test_login_admin_returns_token_and_cookies(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and isinstance(data["access_token"], str)
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        # cookie set
        cookie_names = {c.name for c in r.cookies}
        assert "access_token" in cookie_names

    def test_login_invalid(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpass-xyz"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_me_authenticated(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 401

    def test_register_new_user(self):
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": "secret123", "name": "TestUser"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == email
        assert "access_token" in data

    def test_logout_clears(self, admin_token):
        # use separate session
        s = requests.Session()
        s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        assert r.status_code == 200


# ---------- Proxies CRUD ----------
class TestProxies:
    created_ids: list = []

    def test_create_proxy(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/proxies",
            json={"host": "192.0.2.10", "port": 8080, "protocol": "http", "tags": ["TEST"]},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 201, r.text
        doc = r.json()
        assert doc["host"] == "192.0.2.10"
        assert doc["port"] == 8080
        assert doc["status"] == "unknown"
        assert "id" in doc
        TestProxies.created_ids.append(doc["id"])

    def test_list_proxies(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/proxies", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert any(p["id"] in TestProxies.created_ids for p in rows)

    def test_list_filter_search(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/proxies",
            headers=auth_headers,
            params={"search": "192.0.2.10", "protocol": "http"},
            timeout=15,
        )
        assert r.status_code == 200
        rows = r.json()
        assert all(p["host"] == "192.0.2.10" for p in rows)

    def test_update_proxy(self, auth_headers):
        pid = TestProxies.created_ids[0]
        r = requests.put(
            f"{BASE_URL}/api/proxies/{pid}",
            json={"notes": "updated by test"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        # verify persistence
        r2 = requests.get(f"{BASE_URL}/api/proxies/{pid}", headers=auth_headers, timeout=10)
        assert r2.json()["notes"] == "updated by test"

    def test_check_dead_proxy(self, auth_headers):
        # Create a clearly dead proxy on TEST-NET-1
        rc = requests.post(
            f"{BASE_URL}/api/proxies",
            json={"host": "192.0.2.1", "port": 9, "protocol": "http"},
            headers=auth_headers,
            timeout=15,
        )
        assert rc.status_code == 201
        pid = rc.json()["id"]
        TestProxies.created_ids.append(pid)
        # Run check - should NOT crash, should mark as dead
        r = requests.post(
            f"{BASE_URL}/api/proxies/{pid}/check",
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["status"] == "dead", f"Expected dead, got {doc['status']}; last_error={doc.get('last_error')}"
        assert doc["last_error"] is not None and len(doc["last_error"]) > 0

    def test_recheck_all_background(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/proxies/recheck-all", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_bulk_import_formats(self, auth_headers):
        text = "\n".join([
            "10.10.10.1:8080",
            "10.10.10.2:8080:userA:passA",
            "socks5://userB:passB@10.10.10.3:1080",
            "10.10.10.1:8080",  # duplicate within batch
            "not a proxy line",
        ])
        r = requests.post(
            f"{BASE_URL}/api/proxies/bulk-import",
            json={"text": text, "default_protocol": "http", "default_tags": ["BULKTEST"]},
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["inserted"] >= 3
        assert data["skipped"] >= 1  # at least 1 unparseable or dup
        # collect ids for cleanup
        listing = requests.get(
            f"{BASE_URL}/api/proxies",
            headers=auth_headers,
            params={"search": "10.10.10."},
            timeout=15,
        ).json()
        for p in listing:
            if "BULKTEST" in (p.get("tags") or []):
                TestProxies.created_ids.append(p["id"])

    def test_export_txt(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/proxies/export/download",
            headers=auth_headers,
            params={"format": "txt", "status": "all"},
            timeout=15,
        )
        assert r.status_code == 200
        assert "attachment" in r.headers.get("Content-Disposition", "")
        assert r.headers.get("Content-Type", "").startswith("text/plain")

    def test_export_json(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/proxies/export/download",
            headers=auth_headers,
            params={"format": "json", "status": "all"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/json")

    def test_unauth_protected(self):
        r = requests.get(f"{BASE_URL}/api/proxies", timeout=10)
        assert r.status_code == 401

    def test_bulk_delete_and_cleanup(self, auth_headers):
        if not TestProxies.created_ids:
            return
        r = requests.post(
            f"{BASE_URL}/api/proxies/bulk-delete",
            headers=auth_headers,
            data=__import__("json").dumps(TestProxies.created_ids),
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["deleted"] >= 1


# ---------- Dashboard stats ----------
class TestStats:
    def test_dashboard(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/stats/dashboard", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ["total", "active", "dead", "unknown", "by_protocol", "latency_distribution"]:
            assert k in data
        assert isinstance(data["latency_distribution"], list)


# ---------- API Keys + public endpoint ----------
class TestApiKeysAndPublic:
    created_key_id = None
    raw_key = None

    def test_create_api_key(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/apikeys",
            json={"name": "TEST_key"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert "key" in data and data["key"].startswith("pk_")
        assert "key_preview" in data
        TestApiKeysAndPublic.created_key_id = data["id"]
        TestApiKeysAndPublic.raw_key = data["key"]

    def test_list_api_keys_no_raw(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/apikeys", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        rows = r.json()
        found = [x for x in rows if x["id"] == TestApiKeysAndPublic.created_key_id]
        assert len(found) == 1
        assert "key" not in found[0]
        assert "key_preview" in found[0]

    def test_public_active_missing_key(self):
        r = requests.get(f"{BASE_URL}/api/v1/active", timeout=10)
        assert r.status_code == 401

    def test_public_active_invalid_key(self):
        r = requests.get(
            f"{BASE_URL}/api/v1/active",
            headers={"X-API-Key": "pk_invalid_xxx"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_public_active_json_valid_key(self):
        assert TestApiKeysAndPublic.raw_key
        r = requests.get(
            f"{BASE_URL}/api/v1/active",
            headers={"X-API-Key": TestApiKeysAndPublic.raw_key},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data and "proxies" in data

    def test_public_active_txt(self):
        assert TestApiKeysAndPublic.raw_key
        r = requests.get(
            f"{BASE_URL}/api/v1/active",
            headers={"X-API-Key": TestApiKeysAndPublic.raw_key},
            params={"format": "txt"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("text/plain")

    def test_revoke_api_key_then_rejected(self, auth_headers):
        assert TestApiKeysAndPublic.created_key_id
        r = requests.delete(
            f"{BASE_URL}/api/apikeys/{TestApiKeysAndPublic.created_key_id}",
            headers=auth_headers,
            timeout=10,
        )
        assert r.status_code == 200
        # afterwards the key should be rejected
        r2 = requests.get(
            f"{BASE_URL}/api/v1/active",
            headers={"X-API-Key": TestApiKeysAndPublic.raw_key},
            timeout=10,
        )
        assert r2.status_code == 401
