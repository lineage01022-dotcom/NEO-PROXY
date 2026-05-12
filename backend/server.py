"""Production-Ready Proxy Panel — FastAPI entrypoint."""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from auth import seed_admin  # noqa: E402
from health_checker import health_checker_loop  # noqa: E402
from routes_auth import router as auth_router  # noqa: E402
from routes_proxies import router as proxies_router  # noqa: E402
from routes_apikeys import router as apikeys_router  # noqa: E402
from routes_public import router as public_router  # noqa: E402
from routes_stats import router as stats_router  # noqa: E402
from routes_servers import router as servers_router  # noqa: E402
from routes_bootstrap import router as bootstrap_router  # noqa: E402
from routes_billing import router as billing_router  # noqa: E402
from routes_admin import router as admin_router  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("server")

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Proxy Panel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/api/")
async def root():
    return {"service": "proxy-panel", "status": "ok"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


app.include_router(auth_router)
app.include_router(proxies_router)
app.include_router(apikeys_router)
app.include_router(public_router)
app.include_router(stats_router)
app.include_router(servers_router)
app.include_router(bootstrap_router)
app.include_router(billing_router)
app.include_router(admin_router)


_background_task: asyncio.Task | None = None


@app.on_event("startup")
async def startup_event():
    global _background_task
    # indexes
    await db.users.create_index("email", unique=True)
    await db.proxies.create_index([("host", 1), ("port", 1), ("protocol", 1), ("username", 1)])
    await db.proxies.create_index("status")
    await db.api_keys.create_index("key", unique=True)
    await db.api_keys.create_index("user_id")
    await db.login_attempts.create_index("identifier")
    await db.servers.create_index("id", unique=True)
    await db.enrollment_tokens.create_index("token", unique=True)
    await db.proxies.create_index("server_id")
    await seed_admin(db)
    logger.info("Indexes ensured. Admin seeded.")
    _background_task = asyncio.create_task(health_checker_loop(db))
    logger.info("Background health checker started.")


@app.on_event("shutdown")
async def shutdown_event():
    global _background_task
    if _background_task:
        _background_task.cancel()
    client.close()
