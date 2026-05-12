"""Authentication routes."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    set_auth_cookies,
    clear_auth_cookies,
    verify_password,
)
from models import LoginIn, RegisterIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public_user(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "email": doc["email"],
        "name": doc.get("name"),
        "role": doc.get("role", "user"),
        "plan": doc.get("plan") or "starter",
        "billing_cycle": doc.get("billing_cycle"),
        "plan_started_at": doc.get("plan_started_at"),
        "plan_expires_at": doc.get("plan_expires_at"),
        "banned": bool(doc.get("banned")),
        "created_at": doc.get("created_at"),
    }


@router.post("/register")
async def register(payload: RegisterIn, response: Response):
    from server import db

    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name or email.split("@")[0],
        "role": "user",
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    access = create_access_token(user_doc["id"], email)
    refresh = create_refresh_token(user_doc["id"])
    set_auth_cookies(response, access, refresh)
    return {"access_token": access, "user": _public_user(user_doc)}


@router.post("/login")
async def login(payload: LoginIn, request: Request, response: Response):
    from server import db

    email = payload.email.lower()
    ip = request.client.host if request.client else "-"
    identifier = f"{ip}:{email}"

    # Brute force lockout
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempts and attempts.get("locked_until"):
        locked_until = datetime.fromisoformat(attempts["locked_until"])
        if locked_until > now:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or user.get("banned"):
        # treat banned same as wrong creds (don't leak)
        if user and user.get("banned"):
            raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        # increment fail
        fails = (attempts.get("count", 0) if attempts else 0) + 1
        update = {"identifier": identifier, "count": fails, "last_attempt": now.isoformat()}
        if fails >= 5:
            update["locked_until"] = (now + __import__("datetime").timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"access_token": access, "user": _public_user(user)}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _public_user(user)
