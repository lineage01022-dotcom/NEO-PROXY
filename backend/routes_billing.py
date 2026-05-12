"""User-facing billing endpoints (plans, checkout, payments, subscription status)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from billing import PLANS, NETWORK_INFO, compute_amount, compute_expiry, verify_payment

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- schemas ----------
class CheckoutIn(BaseModel):
    plan: str
    billing_cycle: str = "monthly"  # monthly | annual | one-time (lifetime)
    network: str  # trc20 | bep20


class SubmitTxIn(BaseModel):
    payment_id: str
    tx_hash: str


# ---------- helpers ----------
async def _wallet_for(db, network: str) -> Optional[str]:
    settings = await db.admin_settings.find_one({"_id": "global"}) or {}
    addresses = settings.get("wallets") or {}
    return addresses.get(network)


def _public_payment(doc: dict) -> dict:
    return {k: doc.get(k) for k in (
        "id", "plan", "billing_cycle", "network", "wallet_address",
        "amount_usdt", "tx_hash", "status", "created_at", "verified_at",
        "explorer_url", "reject_reason",
    )}


def _public_subscription(user: dict) -> dict:
    expiry = user.get("plan_expires_at")
    plan = user.get("plan") or "starter"
    return {
        "plan": plan,
        "plan_name": PLANS.get(plan, {}).get("name", plan.title()),
        "billing_cycle": user.get("billing_cycle"),
        "started_at": user.get("plan_started_at"),
        "expires_at": expiry,
        "is_lifetime": plan == "lifetime" or user.get("billing_cycle") == "lifetime",
        "active": _is_active(user),
    }


def _is_active(user: dict) -> bool:
    if user.get("plan") in (None, "starter"):
        return user.get("plan") == "starter"  # starter is always free/active
    if user.get("billing_cycle") == "lifetime" or user.get("plan") == "lifetime":
        return True
    expiry = user.get("plan_expires_at")
    if not expiry:
        return False
    try:
        return datetime.fromisoformat(expiry.replace("Z", "+00:00")) > _now()
    except Exception:
        return False


# ---------- endpoints ----------
@router.get("/plans")
async def list_plans():
    return {"plans": list(PLANS.values()), "networks": NETWORK_INFO}


@router.get("/subscription")
async def get_subscription(user: dict = Depends(get_current_user)):
    from server import db
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return _public_subscription(fresh or user)


@router.post("/checkout")
async def checkout(payload: CheckoutIn, user: dict = Depends(get_current_user)):
    from server import db
    if payload.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Unknown plan")
    if payload.network not in NETWORK_INFO:
        raise HTTPException(status_code=400, detail="Unsupported network")
    if payload.billing_cycle not in ("monthly", "annual", "lifetime"):
        raise HTTPException(status_code=400, detail="Invalid billing cycle")
    if payload.plan == "lifetime":
        payload.billing_cycle = "lifetime"

    amount = compute_amount(payload.plan, payload.billing_cycle)
    wallet = await _wallet_for(db, payload.network)
    if not wallet:
        raise HTTPException(status_code=400, detail=f"Admin has not configured a {payload.network.upper()} wallet yet")

    info = NETWORK_INFO[payload.network]
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "plan": payload.plan,
        "billing_cycle": payload.billing_cycle,
        "network": payload.network,
        "wallet_address": wallet,
        "amount_usdt": amount,
        "tx_hash": None,
        "status": "awaiting_tx",  # awaiting_tx -> submitted -> verifying -> confirmed | rejected
        "created_at": _now().isoformat(),
        "verified_at": None,
        "reject_reason": None,
        "explorer_addr_url": info["explorer_addr"].format(addr=wallet),
    }
    await db.payments.insert_one(doc)
    return _public_payment({**doc, "explorer_url": None})


@router.post("/submit-tx")
async def submit_tx(payload: SubmitTxIn, user: dict = Depends(get_current_user)):
    from server import db
    pay = await db.payments.find_one({"id": payload.payment_id, "user_id": user["id"]}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Payment not found")
    if pay["status"] not in ("awaiting_tx", "rejected"):
        raise HTTPException(status_code=400, detail="Payment is already submitted")
    tx_hash = payload.tx_hash.strip()
    if not tx_hash:
        raise HTTPException(status_code=400, detail="TX hash required")

    explorer = NETWORK_INFO[pay["network"]]["explorer"].format(tx=tx_hash)
    await db.payments.update_one(
        {"id": pay["id"]},
        {"$set": {
            "tx_hash": tx_hash,
            "status": "submitted",
            "submitted_at": _now().isoformat(),
            "explorer_url": explorer,
            "reject_reason": None,
        }},
    )
    return {"ok": True, "explorer_url": explorer}


@router.get("/payments")
async def list_payments(user: dict = Depends(get_current_user)):
    from server import db
    rows = await db.payments.find(
        {"user_id": user["id"]}, {"_id": 0},
    ).sort("created_at", -1).to_list(length=200)
    for r in rows:
        if r.get("tx_hash") and not r.get("explorer_url"):
            r["explorer_url"] = NETWORK_INFO[r["network"]]["explorer"].format(tx=r["tx_hash"])
    return [_public_payment(r) for r in rows]


@router.post("/auto-verify/{payment_id}")
async def auto_verify(payment_id: str, user: dict = Depends(get_current_user)):
    """User-triggered convenience: hit the explorer API to confirm the TX."""
    from server import db
    pay = await db.payments.find_one({"id": payment_id, "user_id": user["id"]}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Payment not found")
    if not pay.get("tx_hash"):
        raise HTTPException(status_code=400, detail="Submit TX hash first")
    result = await verify_payment(pay["network"], pay["tx_hash"], pay["wallet_address"], pay["amount_usdt"])
    if not result.get("ok"):
        return {"ok": False, "error": result.get("error")}
    # mark verifying — actual subscription extension happens on admin approval (or we can auto-approve here)
    # For UX, we DO auto-approve on successful on-chain match.
    await _activate_subscription(db, pay, source="auto")
    return {"ok": True, "message": "Verified on-chain. Subscription activated."}


# ---------- subscription extension ----------
async def _activate_subscription(db, pay: dict, source: str = "admin") -> None:
    plan_id = pay["plan"]
    user_id = pay["user_id"]
    now = _now()
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    # If user already has time left on the SAME plan, extend; otherwise start fresh from now.
    base = now
    cur_exp = user.get("plan_expires_at")
    if user.get("plan") == plan_id and cur_exp:
        try:
            d = datetime.fromisoformat(cur_exp.replace("Z", "+00:00"))
            if d > now:
                base = d
        except Exception:
            pass
    expiry = compute_expiry(base, plan_id, pay["billing_cycle"])
    update = {
        "plan": plan_id,
        "billing_cycle": pay["billing_cycle"],
        "plan_started_at": (user.get("plan_started_at") or now.isoformat()) if user.get("plan") == plan_id else now.isoformat(),
        "plan_expires_at": expiry.isoformat() if expiry else None,
    }
    await db.users.update_one({"id": user_id}, {"$set": update})
    await db.payments.update_one(
        {"id": pay["id"]},
        {"$set": {"status": "confirmed", "verified_at": now.isoformat(), "verified_by": source}},
    )
