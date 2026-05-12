"""API Key management for external scripts."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from models import ApiKeyCreateIn, ApiKeyCreatedOut, ApiKeyOut

router = APIRouter(prefix="/api/apikeys", tags=["apikeys"])


def _public_key_doc(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "key_preview": doc["key_preview"],
        "created_at": doc.get("created_at"),
        "last_used_at": doc.get("last_used_at"),
        "revoked": doc.get("revoked", False),
    }


@router.get("", response_model=List[ApiKeyOut])
async def list_keys(user: dict = Depends(get_current_user)):
    from server import db
    rows = await db.api_keys.find(
        {"user_id": user["id"]},
        {"_id": 0, "key": 0},
    ).sort("created_at", -1).to_list(length=200)
    return [_public_key_doc(r) for r in rows]


@router.post("", response_model=ApiKeyCreatedOut, status_code=201)
async def create_key(payload: ApiKeyCreateIn, user: dict = Depends(get_current_user)):
    from server import db
    raw_key = "pk_" + secrets.token_urlsafe(32)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": payload.name.strip(),
        "key": raw_key,
        "key_preview": raw_key[:8] + "..." + raw_key[-4:],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "revoked": False,
    }
    await db.api_keys.insert_one(doc)
    out = _public_key_doc(doc)
    out["key"] = raw_key
    return out


@router.delete("/{key_id}")
async def revoke_key(key_id: str, user: dict = Depends(get_current_user)):
    from server import db
    result = await db.api_keys.delete_one({"id": key_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"ok": True}
