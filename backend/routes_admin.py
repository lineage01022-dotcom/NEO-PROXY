"""Admin-only routes — full system control."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from admin_dep import require_admin
from billing import PLANS, verify_payment
from routes_billing import _activate_subscription

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_user(u: dict) -> dict:
    return {
        "id": u.get("id"),
        "email": u.get("email"),
        "name": u.get("name"),
        "role": u.get("role", "user"),
        "plan": u.get("plan") or "starter",
        "billing_cycle": u.get("billing_cycle"),
        "plan_expires_at": u.get("plan_expires_at"),
        "banned": bool(u.get("banned")),
        "created_at": u.get("created_at"),
    }


class UserUpdate(BaseModel):
    plan: Optional[str] = None
    billing_cycle: Optional[str] = None
    plan_expires_at: Optional[str] = None
    role: Optional[str] = None
    banned: Optional[bool] = None
    name: Optional[str] = None


class WalletSettings(BaseModel):
    trc20: Optional[str] = None
    bep20: Optional[str] = None
    trc20_qr: Optional[str] = None  # base64 data URL of QR image (e.g. "data:image/png;base64,...")
    bep20_qr: Optional[str] = None


# ---------- Overview ----------
@router.get("/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    from server import db
    total_users   = await db.users.count_documents({})
    admin_users   = await db.users.count_documents({"role": "admin"})
    total_servers = await db.servers.count_documents({})
    total_proxies = await db.proxies.count_documents({})
    pending_pay   = await db.payments.count_documents({"status": "submitted"})
    confirmed_pay = await db.payments.count_documents({"status": "confirmed"})

    plan_dist = {}
    async for row in db.users.aggregate([{"$group": {"_id": "$plan", "n": {"$sum": 1}}}]):
        plan_dist[row["_id"] or "starter"] = row["n"]

    revenue_agg = await db.payments.aggregate([
        {"$match": {"status": "confirmed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_usdt"}}}
    ]).to_list(length=1)
    revenue = (revenue_agg[0]["total"] if revenue_agg else 0) or 0

    return {
        "users": {"total": total_users, "admin": admin_users, "plan_distribution": plan_dist},
        "infrastructure": {"servers": total_servers, "proxies": total_proxies},
        "billing": {"pending_payments": pending_pay, "confirmed_payments": confirmed_pay, "revenue_usdt": round(revenue, 2)},
        "timestamp": _now(),
    }


# ---------- Users ----------
@router.get("/users")
async def list_users(_: dict = Depends(require_admin), search: Optional[str] = None):
    from server import db
    q: dict = {}
    if search:
        import re
        q["email"] = {"$regex": re.escape(search), "$options": "i"}
    rows = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(length=500)
    return [_public_user(u) for u in rows]


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, admin: dict = Depends(require_admin)):
    from server import db
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "plan" in updates and updates["plan"] not in PLANS:
        raise HTTPException(status_code=400, detail="Unknown plan")
    if "role" in updates and updates["role"] not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    res = await db.users.update_one({"id": user_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    fresh = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return _public_user(fresh)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")
    from server import db
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


# ---------- Payments ----------
@router.get("/payments")
async def list_payments(_: dict = Depends(require_admin), status: Optional[str] = None):
    from server import db
    q: dict = {}
    if status and status != "all":
        q["status"] = status
    rows = await db.payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    return rows


@router.post("/payments/{payment_id}/approve")
async def approve_payment(payment_id: str, _: dict = Depends(require_admin)):
    from server import db
    pay = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Payment not found")
    if pay["status"] == "confirmed":
        return {"ok": True, "message": "Already confirmed"}
    await _activate_subscription(db, pay, source="admin")
    return {"ok": True}


@router.post("/payments/{payment_id}/reject")
async def reject_payment(payment_id: str, reason: str = "Manual rejection", _: dict = Depends(require_admin)):
    from server import db
    res = await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "rejected", "reject_reason": reason, "verified_at": _now()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"ok": True}


@router.post("/payments/{payment_id}/auto-verify")
async def admin_auto_verify(payment_id: str, _: dict = Depends(require_admin)):
    from server import db
    pay = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Payment not found")
    if not pay.get("tx_hash"):
        raise HTTPException(status_code=400, detail="No TX hash submitted")
    result = await verify_payment(pay["network"], pay["tx_hash"], pay["wallet_address"], pay["amount_usdt"])
    if result.get("ok"):
        await _activate_subscription(db, pay, source="auto")
    return result


# ---------- Settings ----------
@router.get("/settings")
async def get_settings(_: dict = Depends(require_admin)):
    from server import db
    doc = await db.admin_settings.find_one({"_id": "global"}) or {}
    return {"wallets": doc.get("wallets", {})}


@router.put("/settings/wallets")
async def update_wallets(payload: WalletSettings, _: dict = Depends(require_admin)):
    from server import db
    wallets = payload.model_dump(exclude_unset=True)
    if wallets:
        await db.admin_settings.update_one(
            {"_id": "global"},
            {"$set": {"wallets." + k: v for k, v in wallets.items()}},
            upsert=True,
        )
    doc = await db.admin_settings.find_one({"_id": "global"}) or {}
    return {"wallets": doc.get("wallets", {})}
