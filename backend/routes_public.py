"""Public API for external scripts — authenticated via X-API-Key header."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

router = APIRouter(prefix="/api/v1", tags=["public"])


async def _auth_api_key(api_key: Optional[str]) -> dict:
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    from server import db
    doc = await db.api_keys.find_one({"key": api_key, "revoked": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    await db.api_keys.update_one(
        {"id": doc["id"]},
        {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}},
    )
    return doc


@router.get("/active")
async def get_active_proxies(
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    protocol: Optional[str] = Query(None),
    format: str = Query("json", pattern="^(json|txt)$"),
    limit: int = Query(500, ge=1, le=5000),
):
    """Return active proxies. Used by external automation/blogging scripts."""
    await _auth_api_key(x_api_key)
    from server import db

    q: dict = {"status": "active"}
    if protocol:
        q["protocol"] = protocol.lower()
    rows = await db.proxies.find(q, {"_id": 0}).limit(limit).to_list(length=limit)

    if format == "txt":
        from fastapi.responses import PlainTextResponse
        lines = []
        for p in rows:
            u = p.get("username") or ""
            pw = p.get("password") or ""
            if u or pw:
                lines.append(f"{p['host']}:{p['port']}:{u}:{pw}")
            else:
                lines.append(f"{p['host']}:{p['port']}")
        return PlainTextResponse("\n".join(lines))

    return {"count": len(rows), "proxies": rows}
