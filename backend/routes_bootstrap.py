"""Bootstrap files served to VPS for one-line agent install.

GET /api/bootstrap/{token}/install.sh     -> templated installer
GET /api/bootstrap/agent.py               -> raw agent code
GET /api/bootstrap/squid.conf.tpl         -> squid template
GET /api/bootstrap/dante.conf.tpl         -> dante template
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse, FileResponse

router = APIRouter(prefix="/api/bootstrap", tags=["bootstrap"])

AGENT_DIR = Path(__file__).parent.parent / "agent"


def _panel_url(request: Request) -> str:
    env = os.environ.get("PANEL_PUBLIC_URL")
    if env:
        return env.rstrip("/")
    return f"{request.url.scheme}://{request.headers.get('host', request.url.netloc)}"


@router.get("/{token}/install.sh", response_class=PlainTextResponse)
async def get_install_sh(token: str, request: Request):
    from server import db
    tok = await db.enrollment_tokens.find_one({"token": token}, {"_id": 0})
    if not tok:
        raise HTTPException(status_code=404, detail="Invalid enrollment token")
    if tok.get("used_at"):
        raise HTTPException(status_code=410, detail="Enrollment token already used")
    expires_at = datetime.fromisoformat(tok["expires_at"])
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Enrollment token expired")

    panel_url = _panel_url(request)
    agent_port = tok.get("agent_port", 7878)

    install_sh = (AGENT_DIR / "install.sh").read_text()
    rendered = (
        install_sh
        .replace("__PANEL_URL__", panel_url)
        .replace("__ENROLLMENT_TOKEN__", token)
        .replace("__AGENT_PORT__", str(agent_port))
    )
    return PlainTextResponse(rendered, media_type="text/x-shellscript")


@router.get("/agent.py", response_class=PlainTextResponse)
async def get_agent_py():
    p = AGENT_DIR / "agent.py"
    if not p.exists():
        raise HTTPException(status_code=500, detail="agent.py missing on panel")
    return PlainTextResponse(p.read_text(), media_type="text/x-python")


@router.get("/squid.conf.tpl", response_class=PlainTextResponse)
async def get_squid_tpl():
    return PlainTextResponse((AGENT_DIR / "squid.conf.tpl").read_text(), media_type="text/plain")


@router.get("/dante.conf.tpl", response_class=PlainTextResponse)
async def get_dante_tpl():
    return PlainTextResponse((AGENT_DIR / "dante.conf.tpl").read_text(), media_type="text/plain")
