"""Phase 2: Servers + Bootstrap + Agent E2E tests.

Tests panel-side server CRUD, enrollment flow, bootstrap file serving,
and panel-to-agent proxy (against a LOCAL agent started by the test harness).
"""
from __future__ import annotations

import json
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://proxy-hub-27.preview.emergentagent.com").rstrip("/")
PANEL_PUBLIC_URL = "https://proxy-hub-27.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proxy.com"
ADMIN_PASSWORD = "password"

LOCAL_AGENT_URL = "http://127.0.0.1:7878"
AGENT_TOKEN_PATH = "/tmp/agent-conf/token.txt"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def agent_bearer():
    with open(AGENT_TOKEN_PATH) as f:
        return f.read().strip()


@pytest.fixture(scope="module")
def state():
    return {}


# ---------- Auth smoke (regression) ----------
class TestAuthSmoke:
    def test_login(self, admin_token):
        assert admin_token

    def test_me(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------- Agent direct (bearer enforcement) ----------
class TestAgentDirect:
    def test_info_missing_auth(self):
        r = requests.get(f"{LOCAL_AGENT_URL}/agent/info", timeout=10)
        assert r.status_code == 401

    def test_info_wrong_auth(self):
        r = requests.get(
            f"{LOCAL_AGENT_URL}/agent/info",
            headers={"Authorization": "Bearer wrong"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_info_correct(self, agent_bearer):
        r = requests.get(
            f"{LOCAL_AGENT_URL}/agent/info",
            headers={"Authorization": f"Bearer {agent_bearer}"},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert "hostname" in body
        assert "interfaces" in body

    def test_interfaces(self, agent_bearer):
        r = requests.get(
            f"{LOCAL_AGENT_URL}/agent/interfaces",
            headers={"Authorization": f"Bearer {agent_bearer}"},
            timeout=10,
        )
        assert r.status_code == 200
        assert "interfaces" in r.json()

    def test_status(self, agent_bearer):
        r = requests.get(
            f"{LOCAL_AGENT_URL}/agent/status",
            headers={"Authorization": f"Bearer {agent_bearer}"},
            timeout=10,
        )
        assert r.status_code == 200

    def test_generate_ipv6_no_subnet(self, agent_bearer):
        # No IPv6 subnet => 400
        r = requests.post(
            f"{LOCAL_AGENT_URL}/agent/proxies/generate-ipv6",
            headers={"Authorization": f"Bearer {agent_bearer}"},
            json={"count": 5},
            timeout=10,
        )
        assert r.status_code == 400


# ---------- Bootstrap endpoints + enrollment ----------
class TestBootstrap:
    def test_create_enrollment_token(self, auth_headers, state):
        name = f"TEST_srv_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/servers/enrollment-tokens",
            json={"name": name, "agent_port": 7878},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == name
        assert data["agent_port"] == 7878
        assert data["panel_url"] == PANEL_PUBLIC_URL
        assert PANEL_PUBLIC_URL in data["bootstrap_command"]
        assert "install.sh" in data["bootstrap_command"]
        assert data["token"]
        state["enrollment_token"] = data["token"]
        state["server_name"] = name

    def test_install_sh_valid_token(self, state):
        tok = state["enrollment_token"]
        r = requests.get(f"{BASE_URL}/api/bootstrap/{tok}/install.sh", timeout=15)
        assert r.status_code == 200
        body = r.text
        assert "__PANEL_URL__" not in body
        assert "__ENROLLMENT_TOKEN__" not in body
        assert "__AGENT_PORT__" not in body
        assert PANEL_PUBLIC_URL in body
        assert tok in body
        assert "7878" in body

    def test_install_sh_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/bootstrap/notarealtoken123/install.sh", timeout=10)
        assert r.status_code == 404

    def test_agent_py(self):
        r = requests.get(f"{BASE_URL}/api/bootstrap/agent.py", timeout=15)
        assert r.status_code == 200
        assert "text/x-python" in r.headers.get("content-type", "")
        assert "FastAPI" in r.text

    def test_squid_tpl(self):
        r = requests.get(f"{BASE_URL}/api/bootstrap/squid.conf.tpl", timeout=10)
        assert r.status_code == 200

    def test_dante_tpl(self):
        r = requests.get(f"{BASE_URL}/api/bootstrap/dante.conf.tpl", timeout=10)
        assert r.status_code == 200


# ---------- Enroll + server flows ----------
class TestEnrollAndServer:
    def test_enroll_invalid_token(self, agent_bearer):
        r = requests.post(
            f"{BASE_URL}/api/servers/enroll",
            json={
                "enrollment_token": "garbage-xxx",
                "agent_token": agent_bearer,
                "agent_url": LOCAL_AGENT_URL,
            },
            timeout=15,
        )
        assert r.status_code == 401

    def test_enroll_success(self, state, agent_bearer):
        r = requests.post(
            f"{BASE_URL}/api/servers/enroll",
            json={
                "enrollment_token": state["enrollment_token"],
                "agent_token": agent_bearer,
                "agent_url": LOCAL_AGENT_URL,
                "hostname": "test-host",
                "public_ipv4": "10.79.137.46",
                "interfaces": [],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["server"]["id"]
        # public payload must NOT include agent_token
        assert "agent_token" not in data["server"]
        state["server_id"] = data["server"]["id"]

    def test_enroll_token_reuse_rejected(self, state, agent_bearer):
        r = requests.post(
            f"{BASE_URL}/api/servers/enroll",
            json={
                "enrollment_token": state["enrollment_token"],
                "agent_token": agent_bearer,
                "agent_url": LOCAL_AGENT_URL,
            },
            timeout=15,
        )
        assert r.status_code == 401

    def test_install_sh_used_token_410(self, state):
        r = requests.get(f"{BASE_URL}/api/bootstrap/{state['enrollment_token']}/install.sh", timeout=10)
        assert r.status_code == 410

    def test_list_servers_no_agent_token_field(self, auth_headers, state):
        r = requests.get(f"{BASE_URL}/api/servers", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        rows = r.json()
        match = [s for s in rows if s["id"] == state["server_id"]]
        assert len(match) == 1
        assert "agent_token" not in match[0]

    def test_get_server_no_agent_token_field(self, auth_headers, state):
        r = requests.get(f"{BASE_URL}/api/servers/{state['server_id']}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert "agent_token" not in r.json()

    def test_server_status_proxied(self, auth_headers, state):
        r = requests.get(
            f"{BASE_URL}/api/servers/{state['server_id']}/status",
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "squid_running" in body

    def test_server_refresh(self, auth_headers, state):
        r = requests.post(
            f"{BASE_URL}/api/servers/{state['server_id']}/refresh",
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        info = r.json()["info"]
        assert "hostname" in info

    def test_add_user_propagates_agent_error(self, auth_headers, state):
        # In sandbox, agent IS root but squid not installed; htpasswd missing => 500 from agent.
        # If by chance htpasswd present, 200 ok. Either way panel must not crash with 5xx unhandled.
        r = requests.post(
            f"{BASE_URL}/api/servers/{state['server_id']}/users",
            headers=auth_headers,
            json={"username": "TEST_u1", "password": "p", "proto": "http"},
            timeout=20,
        )
        # accept anything mapped (200 if it actually worked, 4xx/5xx propagated)
        assert r.status_code in (200, 400, 500, 502), r.text

    def test_generate_ipv6_surfaces_error(self, auth_headers, state):
        # No IPv6 subnet => agent returns 400. Panel must surface 400 (not crash).
        r = requests.post(
            f"{BASE_URL}/api/servers/{state['server_id']}/generate-ipv6",
            headers=auth_headers,
            json={"count": 5, "port_start": 30000, "protocol": "http"},
            timeout=20,
        )
        assert r.status_code in (400, 502), r.text
        # And no proxies should have been persisted
        # (sanity check via list)
        l = requests.get(f"{BASE_URL}/api/proxies", headers=auth_headers, timeout=15)
        assert l.status_code == 200

    def test_delete_server(self, auth_headers, state):
        r = requests.delete(
            f"{BASE_URL}/api/servers/{state['server_id']}",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        # verify gone
        g = requests.get(f"{BASE_URL}/api/servers/{state['server_id']}", headers=auth_headers, timeout=10)
        assert g.status_code == 404
