"""Billing & subscription helpers."""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

# Public plan catalog — mirrors the frontend Pricing page.
PLANS = {
    "free":    {"id": "free",    "name": "Free",    "monthly_usd": 0.0,   "ipv6_quota": 10,    "servers_quota": 1},
    "starter": {"id": "starter", "name": "Starter", "monthly_usd": 9.99,  "ipv6_quota": 100,   "servers_quota": 1},
    "pro":     {"id": "pro",     "name": "Pro",     "monthly_usd": 19.99, "ipv6_quota": 1000,  "servers_quota": 5},
    "elite":   {"id": "elite",   "name": "Elite",   "monthly_usd": 49.99, "ipv6_quota": 5000,  "servers_quota": 9999},
    "lifetime":{"id": "lifetime","name": "Lifetime","monthly_usd": 149.0, "ipv6_quota": 5000,  "servers_quota": 9999, "lifetime": True},
}

NETWORK_INFO = {
    "trc20": {"label": "USDT (TRC-20)", "explorer": "https://tronscan.org/#/transaction/{tx}", "explorer_addr": "https://tronscan.org/#/address/{addr}"},
    "bep20": {"label": "USDT (BEP-20)", "explorer": "https://bscscan.com/tx/{tx}",            "explorer_addr": "https://bscscan.com/address/{addr}"},
}

USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
USDT_BEP20_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"


def compute_amount(plan_id: str, billing_cycle: str) -> float:
    p = PLANS.get(plan_id)
    if not p:
        raise ValueError("Unknown plan")
    if plan_id == "lifetime":
        return p["monthly_usd"]
    if billing_cycle == "annual":
        return round(p["monthly_usd"] * 10, 2)  # 2 months free
    return p["monthly_usd"]


def compute_expiry(start: datetime, plan_id: str, billing_cycle: str) -> Optional[datetime]:
    if plan_id == "lifetime":
        return None  # no expiry
    if billing_cycle == "annual":
        return start + timedelta(days=365)
    return start + timedelta(days=30)


# ---------- On-chain verification (best effort) ----------
async def verify_trc20(tx_hash: str, expected_to: str, min_amount_usdt: float) -> dict:
    url = f"https://apilist.tronscanapi.com/api/transaction-info?hash={tx_hash}"
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(url)
            data = r.json() if r.status_code == 200 else {}
    except Exception as e:
        return {"ok": False, "error": f"network error: {e}"}

    if not data or data.get("confirmed") is False:
        return {"ok": False, "error": "Transaction not confirmed yet"}

    transfers = data.get("tokenTransferInfo") or {}
    # tokenTransferInfo can be a dict (single) or list — handle both
    candidates = transfers if isinstance(transfers, list) else [transfers] if transfers else []
    for t in candidates:
        if (t.get("contract_address") or "").lower() != USDT_TRC20_CONTRACT.lower():
            continue
        if (t.get("to_address") or "").lower() != expected_to.lower():
            continue
        try:
            amount = int(t.get("amount_str") or t.get("amount") or 0) / 10 ** int(t.get("decimals", 6))
        except Exception:
            amount = 0
        if amount + 0.5 < min_amount_usdt:  # tolerate small underpay rounding
            return {"ok": False, "error": f"Underpaid: received {amount} USDT (need {min_amount_usdt})"}
        return {"ok": True, "amount": amount, "to": t.get("to_address")}
    return {"ok": False, "error": "No matching USDT transfer in this TX"}


async def verify_bep20(tx_hash: str, expected_to: str, min_amount_usdt: float) -> dict:
    api_key = os.environ.get("BSCSCAN_API_KEY", "YourApiKeyToken")
    url = (
        "https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt"
        f"&txhash={tx_hash}&apikey={api_key}"
    )
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            receipt = (await c.get(url)).json()
    except Exception as e:
        return {"ok": False, "error": f"network error: {e}"}

    res = receipt.get("result") or {}
    if not res or res.get("status") != "0x1":
        return {"ok": False, "error": "Transaction not confirmed"}

    # parse transfer logs (Transfer event sig)
    transfer_topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    for log in res.get("logs") or []:
        if (log.get("address") or "").lower() != USDT_BEP20_CONTRACT.lower():
            continue
        topics = log.get("topics") or []
        if not topics or topics[0].lower() != transfer_topic:
            continue
        if len(topics) < 3:
            continue
        to_addr = "0x" + topics[2][-40:]
        if to_addr.lower() != expected_to.lower():
            continue
        try:
            amount = int(log.get("data"), 16) / 10 ** 18  # USDT-BEP20 has 18 decimals
        except Exception:
            amount = 0
        if amount + 0.5 < min_amount_usdt:
            return {"ok": False, "error": f"Underpaid: {amount} USDT (need {min_amount_usdt})"}
        return {"ok": True, "amount": amount, "to": to_addr}
    return {"ok": False, "error": "No matching USDT transfer in TX logs"}


async def verify_payment(network: str, tx_hash: str, expected_to: str, amount_usdt: float) -> dict:
    if network == "trc20":
        return await verify_trc20(tx_hash, expected_to, amount_usdt)
    if network == "bep20":
        return await verify_bep20(tx_hash, expected_to, amount_usdt)
    return {"ok": False, "error": f"Unsupported network: {network}"}
