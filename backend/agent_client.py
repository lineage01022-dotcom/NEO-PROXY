"""HTTP client for talking to a remote ProxyHub Agent."""
from __future__ import annotations

from typing import Any, Optional

import httpx
from fastapi import HTTPException


class AgentClient:
    def __init__(self, agent_url: str, agent_token: str, timeout: float = 25.0):
        self.base = agent_url.rstrip("/")
        self.token = agent_token
        self.timeout = timeout

    @property
    def headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    async def _req(self, method: str, path: str, **kw) -> Any:
        url = self.base + path
        try:
            async with httpx.AsyncClient(verify=False, timeout=self.timeout) as c:
                r = await c.request(method, url, headers=self.headers, **kw)
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Agent unreachable: {e}")
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=f"Agent error: {r.text[:300]}")
        if r.headers.get("content-type", "").startswith("application/json"):
            return r.json()
        return r.text

    async def info(self): return await self._req("GET", "/agent/info")
    async def status(self): return await self._req("GET", "/agent/status")
    async def interfaces(self): return await self._req("GET", "/agent/interfaces")
    async def install(self): return await self._req("POST", "/agent/install")
    async def add_user(self, username: str, password: str, proto: str = "http"):
        return await self._req("POST", "/agent/users", json={"username": username, "password": password, "proto": proto})
    async def remove_user(self, username: str, proto: str = "http"):
        return await self._req("DELETE", f"/agent/users/{username}", params={"proto": proto})
    async def generate_ipv6(self, count: int, port_start: int = 30000,
                            subnet: Optional[str] = None, interface: Optional[str] = None,
                            auth_user: Optional[str] = None, auth_pass: Optional[str] = None,
                            protocol: str = "http"):
        return await self._req("POST", "/agent/proxies/generate-ipv6", json={
            "count": count, "port_start": port_start, "subnet": subnet, "interface": interface,
            "auth_user": auth_user, "auth_pass": auth_pass, "protocol": protocol,
        })
