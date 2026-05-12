"""Proxy management routes (CRUD, bulk import, export, manual checks)."""
from __future__ import annotations

import io
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse

from auth import get_current_user
from models import (
    BulkImportIn,
    BulkImportOut,
    ProxyIn,
    ProxyOut,
    ProxyUpdate,
    PROTOCOLS,
)

router = APIRouter(prefix="/api/proxies", tags=["proxies"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _validate_protocol(protocol: str) -> str:
    p = (protocol or "http").lower()
    if p not in PROTOCOLS:
        raise HTTPException(status_code=400, detail=f"Invalid protocol '{protocol}'")
    return p


@router.get("", response_model=List[ProxyOut])
async def list_proxies(
    user: dict = Depends(get_current_user),
    status: Optional[str] = Query(None),
    protocol: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    skip: int = Query(0, ge=0),
):
    from server import db

    q: dict = {}
    if status and status != "all":
        q["status"] = status
    if protocol and protocol != "all":
        q["protocol"] = protocol.lower()
    if tag:
        q["tags"] = tag
    if search:
        # match host or country case-insensitive
        q["$or"] = [
            {"host": {"$regex": re.escape(search), "$options": "i"}},
            {"country": {"$regex": re.escape(search), "$options": "i"}},
            {"notes": {"$regex": re.escape(search), "$options": "i"}},
        ]
    cursor = db.proxies.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)


@router.post("", response_model=ProxyOut, status_code=201)
async def create_proxy(payload: ProxyIn, user: dict = Depends(get_current_user)):
    from server import db

    protocol = _validate_protocol(payload.protocol)
    now = _now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "host": payload.host.strip(),
        "port": payload.port,
        "username": payload.username,
        "password": payload.password,
        "protocol": protocol,
        "tags": payload.tags or [],
        "country": payload.country,
        "notes": payload.notes,
        "status": "unknown",
        "latency_ms": None,
        "last_checked_at": None,
        "last_error": None,
        "fail_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.proxies.insert_one(doc)
    return _clean(doc)


@router.get("/{proxy_id}", response_model=ProxyOut)
async def get_proxy(proxy_id: str, user: dict = Depends(get_current_user)):
    from server import db
    doc = await db.proxies.find_one({"id": proxy_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Proxy not found")
    return doc


@router.put("/{proxy_id}", response_model=ProxyOut)
async def update_proxy(proxy_id: str, payload: ProxyUpdate, user: dict = Depends(get_current_user)):
    from server import db
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "protocol" in updates:
        updates["protocol"] = _validate_protocol(updates["protocol"])
    updates["updated_at"] = _now_iso()
    result = await db.proxies.update_one({"id": proxy_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Proxy not found")
    doc = await db.proxies.find_one({"id": proxy_id}, {"_id": 0})
    return doc


@router.delete("/{proxy_id}")
async def delete_proxy(proxy_id: str, user: dict = Depends(get_current_user)):
    from server import db
    result = await db.proxies.delete_one({"id": proxy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proxy not found")
    return {"ok": True}


@router.post("/bulk-delete")
async def bulk_delete(ids: List[str], user: dict = Depends(get_current_user)):
    from server import db
    result = await db.proxies.delete_many({"id": {"$in": ids}})
    return {"deleted": result.deleted_count}


# ---------- BULK IMPORT ----------
_LINE_PATTERNS = [
    # protocol://user:pass@host:port
    re.compile(r"^(?P<protocol>https?|socks[45])://(?:(?P<user>[^:@]+):(?P<pass>[^@]+)@)?(?P<host>[^:/]+):(?P<port>\d+)/?$", re.I),
    # host:port:user:pass
    re.compile(r"^(?P<host>[^\s:]+):(?P<port>\d+):(?P<user>[^:\s]+):(?P<pass>[^\s]+)$"),
    # host:port@user:pass
    re.compile(r"^(?P<host>[^\s:@]+):(?P<port>\d+)@(?P<user>[^:\s]+):(?P<pass>[^\s]+)$"),
    # host:port
    re.compile(r"^(?P<host>[^\s:]+):(?P<port>\d+)$"),
]


def _parse_line(line: str, default_protocol: str) -> Optional[dict]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    for pat in _LINE_PATTERNS:
        m = pat.match(line)
        if m:
            d = m.groupdict()
            return {
                "protocol": (d.get("protocol") or default_protocol).lower(),
                "host": d["host"],
                "port": int(d["port"]),
                "username": d.get("user"),
                "password": d.get("pass"),
            }
    return None


@router.post("/bulk-import", response_model=BulkImportOut)
async def bulk_import(payload: BulkImportIn, user: dict = Depends(get_current_user)):
    from server import db

    default_protocol = _validate_protocol(payload.default_protocol)
    inserted = 0
    skipped = 0
    errors: list[str] = []
    now = _now_iso()
    docs: list[dict] = []
    seen_keys: set[tuple] = set()

    for idx, raw in enumerate(payload.text.splitlines(), start=1):
        parsed = _parse_line(raw, default_protocol)
        if parsed is None:
            if raw.strip():
                errors.append(f"Line {idx}: could not parse '{raw.strip()[:80]}'")
                skipped += 1
            continue
        if parsed["protocol"] not in PROTOCOLS:
            errors.append(f"Line {idx}: invalid protocol '{parsed['protocol']}'")
            skipped += 1
            continue
        key = (parsed["protocol"], parsed["host"], parsed["port"], parsed.get("username") or "")
        if key in seen_keys:
            skipped += 1
            continue
        seen_keys.add(key)
        # duplicate check against existing
        existing = await db.proxies.find_one({
            "protocol": parsed["protocol"],
            "host": parsed["host"],
            "port": parsed["port"],
            "username": parsed.get("username"),
        })
        if existing:
            skipped += 1
            continue
        docs.append({
            "id": str(uuid.uuid4()),
            "host": parsed["host"],
            "port": parsed["port"],
            "username": parsed.get("username"),
            "password": parsed.get("password"),
            "protocol": parsed["protocol"],
            "tags": payload.default_tags or [],
            "country": payload.default_country,
            "notes": None,
            "status": "unknown",
            "latency_ms": None,
            "last_checked_at": None,
            "last_error": None,
            "fail_count": 0,
            "created_at": now,
            "updated_at": now,
        })

    if docs:
        await db.proxies.insert_many(docs)
        inserted = len(docs)

    return BulkImportOut(inserted=inserted, skipped=skipped, errors=errors[:50])


# ---------- EXPORT ----------
@router.get("/export/download")
async def export_proxies(
    user: dict = Depends(get_current_user),
    format: str = Query("txt", pattern="^(txt|json)$"),
    status: Optional[str] = Query("active"),
):
    from server import db
    q: dict = {}
    if status and status != "all":
        q["status"] = status

    rows = await db.proxies.find(q, {"_id": 0}).to_list(length=10000)

    if format == "json":
        body = json.dumps(rows, default=str, indent=2)
        return StreamingResponse(
            io.BytesIO(body.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=proxies.json"},
        )

    # txt: host:port:user:pass per line
    lines = []
    for p in rows:
        user_part = p.get("username") or ""
        pass_part = p.get("password") or ""
        if user_part or pass_part:
            lines.append(f"{p['host']}:{p['port']}:{user_part}:{pass_part}")
        else:
            lines.append(f"{p['host']}:{p['port']}")
    body = "\n".join(lines) + "\n"
    return StreamingResponse(
        io.BytesIO(body.encode("utf-8")),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=proxies.txt"},
    )


# ---------- MANUAL CHECKS ----------
@router.post("/{proxy_id}/check", response_model=ProxyOut)
async def check_one(proxy_id: str, user: dict = Depends(get_current_user)):
    from server import db
    from health_checker import check_proxy

    doc = await db.proxies.find_one({"id": proxy_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Proxy not found")
    await check_proxy(db, doc)
    return await db.proxies.find_one({"id": proxy_id}, {"_id": 0})


@router.post("/recheck-all")
async def recheck_all(background: BackgroundTasks, user: dict = Depends(get_current_user)):
    from server import db
    from health_checker import run_check_cycle

    background.add_task(run_check_cycle, db)
    return {"ok": True, "message": "Health check started in background"}
