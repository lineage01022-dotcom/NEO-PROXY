"""Server (VPS worker) management routes and agent enrollment."""
from __future__ import annotations

import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from agent_client import AgentClient
from auth import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/servers", tags=["servers"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Schemas ----------
class CreateEnrollmentTokenIn(BaseModel):
    name: str
    agent_port: int = 7878


class CreateEnrollmentTokenOut(BaseModel):
    token: str
    name: str
    agent_port: int
    panel_url: str
    bootstrap_command: str
    expires_at: str


class EnrollIn(BaseModel):
    enrollment_token: str
    agent_token: str
    agent_url: str
    hostname: Optional[str] = None
    public_ipv4: Optional[str] = None
    ipv6_subnet: Optional[str] = None
    interfaces: list = []


class ServerOut(BaseModel):
    id: str
    name: str
    hostname: Optional[str] = None
    agent_url: str
    public_ipv4: Optional[str] = None
    ipv6_subnet: Optional[str] = None
    status: str = "unknown"
    last_seen: Optional[str] = None
    interfaces: list = []
    created_at: Optional[str] = None


class GenerateIPv6PanelIn(BaseModel):
    count: int = 100
    port_start: int = 30000
    subnet: Optional[str] = None
    interface: Optional[str] = None
    auth_user: Optional[str] = None
    auth_pass: Optional[str] = None
    protocol: str = "http"
    tag: Optional[str] = None


class AgentUserIn(BaseModel):
    username: str
    password: str
    proto: str = "http"


# ---------- helpers ----------
def _public(server: dict) -> dict:
    return {k: server.get(k) for k in (
        "id", "name", "hostname", "agent_url", "public_ipv4", "ipv6_subnet",
        "status", "last_seen", "interfaces", "created_at",
    )}


async def _client_for(db, server_id: str) -> tuple[dict, AgentClient]:
    server = await db.servers.find_one({"id": server_id}, {"_id": 0})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    token = server.get("agent_token")
    if not token:
        raise HTTPException(status_code=400, detail="Server has no agent token (not enrolled)")
    return server, AgentClient(server["agent_url"], token)


def _panel_url(request: Request) -> str:
    env = os.environ.get("PANEL_PUBLIC_URL")
    if env:
        return env.rstrip("/")
    # derive from request
    return f"{request.url.scheme}://{request.headers.get('host', request.url.netloc)}"


# ---------- Enrollment ----------
@router.post("/enrollment-tokens", response_model=CreateEnrollmentTokenOut)
async def create_enrollment_token(
    payload: CreateEnrollmentTokenIn,
    request: Request,
    user: dict = Depends(get_current_user),
):
    from server import db

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=2)
    doc = {
        "id": str(uuid.uuid4()),
        "token": token,
        "name": payload.name,
        "agent_port": payload.agent_port,
        "created_by": user["id"],
        "created_at": _now_iso(),
        "expires_at": expires.isoformat(),
        "used_at": None,
    }
    await db.enrollment_tokens.insert_one(doc)

    base = _panel_url(request)
    bootstrap = (
        f"curl -fsSL {base}/api/bootstrap/{token}/install.sh | sudo bash"
    )
    return CreateEnrollmentTokenOut(
        token=token,
        name=payload.name,
        agent_port=payload.agent_port,
        panel_url=base,
        bootstrap_command=bootstrap,
        expires_at=expires.isoformat(),
    )


@router.post("/enroll")
async def enroll(payload: EnrollIn):
    """Called BY an agent during bootstrap. No user auth — protected by one-time token."""
    from server import db

    tok = await db.enrollment_tokens.find_one({"token": payload.enrollment_token}, {"_id": 0})
    if not tok:
        raise HTTPException(status_code=401, detail="Invalid enrollment token")
    if tok.get("used_at"):
        raise HTTPException(status_code=401, detail="Enrollment token already used")
    expires_at = datetime.fromisoformat(tok["expires_at"])
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Enrollment token expired")

    now = _now_iso()
    server_doc = {
        "id": str(uuid.uuid4()),
        "name": tok["name"],
        "hostname": payload.hostname,
        "agent_url": payload.agent_url,
        "agent_token": payload.agent_token,  # used by panel to talk back to agent
        "public_ipv4": payload.public_ipv4,
        "ipv6_subnet": payload.ipv6_subnet,
        "interfaces": payload.interfaces or [],
        "status": "online",
        "last_seen": now,
        "created_at": now,
        "created_by": tok["created_by"],
    }
    await db.servers.insert_one(server_doc)
    await db.enrollment_tokens.update_one(
        {"token": payload.enrollment_token},
        {"$set": {"used_at": now, "server_id": server_doc["id"]}},
    )
    return {"ok": True, "server": _public(server_doc)}


# ---------- Listing / management ----------
@router.get("", response_model=List[ServerOut])
async def list_servers(user: dict = Depends(get_current_user)):
    from server import db
    rows = await db.servers.find({}, {"_id": 0, "agent_token": 0}).sort("created_at", -1).to_list(length=200)
    return [_public(r) for r in rows]


@router.get("/{server_id}", response_model=ServerOut)
async def get_server(server_id: str, user: dict = Depends(get_current_user)):
    from server import db
    row = await db.servers.find_one({"id": server_id}, {"_id": 0, "agent_token": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Server not found")
    return _public(row)


@router.delete("/{server_id}")
async def delete_server(server_id: str, user: dict = Depends(get_current_user)):
    from server import db
    res = await db.servers.delete_one({"id": server_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Server not found")
    # also delete any hosted proxies tied to it
    await db.proxies.delete_many({"server_id": server_id})
    return {"ok": True}


@router.post("/{server_id}/refresh")
async def refresh_server(server_id: str, user: dict = Depends(get_current_user)):
    from server import db
    server, client = await _client_for(db, server_id)
    info = await client.info()
    update = {
        "interfaces": info.get("interfaces", []),
        "ipv6_subnet": info.get("ipv6_subnet"),
        "public_ipv4": info.get("primary_ipv4"),
        "hostname": info.get("hostname"),
        "status": "online",
        "last_seen": _now_iso(),
        "info": info,
    }
    await db.servers.update_one({"id": server_id}, {"$set": update})
    return {"ok": True, "info": info}


@router.post("/{server_id}/install")
async def install_software(server_id: str, user: dict = Depends(get_current_user)):
    from server import db
    server, client = await _client_for(db, server_id)
    result = await client.install()
    await db.servers.update_one({"id": server_id}, {"$set": {"last_seen": _now_iso()}})
    return result


@router.get("/{server_id}/status")
async def server_status(server_id: str, user: dict = Depends(get_current_user)):
    from server import db
    server, client = await _client_for(db, server_id)
    try:
        st = await client.status()
        await db.servers.update_one({"id": server_id}, {"$set": {"status": "online", "last_seen": _now_iso()}})
        return st
    except HTTPException as e:
        await db.servers.update_one({"id": server_id}, {"$set": {"status": "offline"}})
        raise


@router.post("/{server_id}/users")
async def add_user(server_id: str, payload: AgentUserIn, user: dict = Depends(get_current_user)):
    from server import db
    server, client = await _client_for(db, server_id)
    return await client.add_user(payload.username, payload.password, payload.proto)


@router.delete("/{server_id}/users/{username}")
async def remove_user(server_id: str, username: str, proto: str = "http", user: dict = Depends(get_current_user)):
    from server import db
    server, client = await _client_for(db, server_id)
    return await client.remove_user(username, proto)


@router.post("/{server_id}/generate-ipv6")
async def generate_ipv6(server_id: str, payload: GenerateIPv6PanelIn, user: dict = Depends(get_current_user)):
    from server import db
    server, client = await _client_for(db, server_id)

    # Optional: ensure auth user exists
    auth_user = payload.auth_user or f"u_{secrets.token_hex(4)}"
    auth_pass = payload.auth_pass or secrets.token_urlsafe(12)

    result = await client.generate_ipv6(
        count=payload.count,
        port_start=payload.port_start,
        subnet=payload.subnet,
        interface=payload.interface,
        auth_user=auth_user,
        auth_pass=auth_pass,
        protocol=payload.protocol,
    )

    # persist generated proxies in DB
    host_ip = result.get("server_ipv4") or server.get("public_ipv4")
    now = _now_iso()
    docs = []
    for p in result.get("proxies", []):
        docs.append({
            "id": str(uuid.uuid4()),
            "host": host_ip,
            "port": p["listen_port"],
            "username": auth_user,
            "password": auth_pass,
            "protocol": payload.protocol,
            "tags": (["hosted", "ipv6-rotation"] + ([payload.tag] if payload.tag else [])),
            "country": None,
            "notes": f"outbound IPv6: {p['outbound_ipv6']}",
            "status": "unknown",
            "latency_ms": None,
            "last_checked_at": None,
            "last_error": None,
            "fail_count": 0,
            "created_at": now,
            "updated_at": now,
            "server_id": server_id,
            "outbound_ipv6": p["outbound_ipv6"],
            "is_hosted": True,
        })
    if docs:
        await db.proxies.insert_many(docs)

    return {
        "ok": True,
        "inserted": len(docs),
        "auth_user": auth_user,
        "auth_pass": auth_pass,
        "interface": result.get("interface"),
        "subnet": result.get("subnet"),
    }
