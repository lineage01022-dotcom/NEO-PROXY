"""Dashboard statistics route."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from auth import get_current_user

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    from server import db

    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    by_status = {row["_id"]: row["count"] async for row in db.proxies.aggregate(pipeline)}

    proto_pipeline = [{"$group": {"_id": "$protocol", "count": {"$sum": 1}}}]
    by_protocol = {row["_id"]: row["count"] async for row in db.proxies.aggregate(proto_pipeline)}

    latency_agg = await db.proxies.aggregate([
        {"$match": {"status": "active", "latency_ms": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$latency_ms"}, "max": {"$max": "$latency_ms"}, "min": {"$min": "$latency_ms"}}},
    ]).to_list(length=1)
    lat = latency_agg[0] if latency_agg else {"avg": 0, "max": 0, "min": 0}

    total = sum(by_status.values())
    active = by_status.get("active", 0)
    dead = by_status.get("dead", 0)
    unknown = by_status.get("unknown", 0)
    checking = by_status.get("checking", 0)

    # latency buckets for chart
    buckets = [
        {"label": "<100ms", "min": 0, "max": 100},
        {"label": "100-300", "min": 100, "max": 300},
        {"label": "300-600", "min": 300, "max": 600},
        {"label": "600-1000", "min": 600, "max": 1000},
        {"label": ">1s", "min": 1000, "max": 10**9},
    ]
    latency_dist = []
    for b in buckets:
        cnt = await db.proxies.count_documents({
            "status": "active",
            "latency_ms": {"$gte": b["min"], "$lt": b["max"]},
        })
        latency_dist.append({"label": b["label"], "count": cnt})

    # last 7 checks aggregated by day for activity
    return {
        "total": total,
        "active": active,
        "dead": dead,
        "unknown": unknown,
        "checking": checking,
        "healthy_percent": round((active / total) * 100, 1) if total else 0,
        "avg_latency_ms": round(lat.get("avg") or 0, 1),
        "max_latency_ms": int(lat.get("max") or 0),
        "min_latency_ms": int(lat.get("min") or 0),
        "by_protocol": by_protocol,
        "latency_distribution": latency_dist,
    }
