"""Async proxy health checker.

For each proxy, attempts to fetch HEALTH_CHECK_URL through the proxy.
Updates `status`, `latency_ms`, `last_checked_at`, `fail_count`, `last_error`.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx

logger = logging.getLogger("health_checker")


def _build_proxy_url(p: dict) -> str:
    proto = p.get("protocol") or "http"
    host = p["host"]
    port = p["port"]
    user = p.get("username")
    pwd = p.get("password")
    auth = ""
    if user:
        auth = quote(user, safe="") + (":" + quote(pwd or "", safe="") if pwd else "") + "@"
    return f"{proto}://{auth}{host}:{port}"


async def check_proxy(db, proxy: dict) -> None:
    url = os.environ.get("HEALTH_CHECK_URL", "https://api.ipify.org?format=json")
    timeout_s = float(os.environ.get("HEALTH_CHECK_TIMEOUT_SECONDS", "10"))
    proxy_url = _build_proxy_url(proxy)
    started = time.perf_counter()
    status = "dead"
    latency_ms: Optional[int] = None
    last_error: Optional[str] = None

    try:
        async with httpx.AsyncClient(
            proxy=proxy_url,
            timeout=timeout_s,
            follow_redirects=False,
            verify=False,
        ) as client:
            resp = await client.get(url)
            latency_ms = int((time.perf_counter() - started) * 1000)
            if 200 <= resp.status_code < 400:
                status = "active"
            else:
                last_error = f"HTTP {resp.status_code}"
    except httpx.ProxyError as e:
        last_error = f"Proxy error: {str(e)[:200]}"
    except httpx.ConnectError as e:
        last_error = f"Connect error: {str(e)[:200]}"
    except httpx.TimeoutException:
        last_error = f"Timeout after {timeout_s}s"
    except Exception as e:
        last_error = f"{type(e).__name__}: {str(e)[:200]}"

    update = {
        "status": status,
        "latency_ms": latency_ms,
        "last_checked_at": datetime.now(timezone.utc).isoformat(),
        "last_error": last_error,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if status == "active":
        update["fail_count"] = 0
    else:
        update["fail_count"] = (proxy.get("fail_count") or 0) + 1

    await db.proxies.update_one({"id": proxy["id"]}, {"$set": update})


async def run_check_cycle(db) -> None:
    concurrency = int(os.environ.get("HEALTH_CHECK_CONCURRENCY", "20"))
    sem = asyncio.Semaphore(concurrency)
    cursor = db.proxies.find({}, {"_id": 0})
    proxies = await cursor.to_list(length=10000)
    if not proxies:
        return

    # Mark all as checking for UI feedback
    ids = [p["id"] for p in proxies]
    await db.proxies.update_many({"id": {"$in": ids}}, {"$set": {"status": "checking"}})

    async def _run(p):
        async with sem:
            try:
                await check_proxy(db, p)
            except Exception as e:
                logger.exception("check_proxy crashed for %s: %s", p.get("id"), e)

    await asyncio.gather(*[_run(p) for p in proxies])
    logger.info("Health check cycle complete: %d proxies", len(proxies))


async def health_checker_loop(db) -> None:
    interval = int(os.environ.get("HEALTH_CHECK_INTERVAL_SECONDS", "600"))
    # initial small delay so server is ready
    await asyncio.sleep(5)
    while True:
        try:
            await run_check_cycle(db)
        except Exception as e:
            logger.exception("health_checker_loop iteration failed: %s", e)
        await asyncio.sleep(interval)
