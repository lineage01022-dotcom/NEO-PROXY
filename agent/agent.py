"""ProxyHub Agent — runs on the user's VPS (Ubuntu/Debian).

Self-contained FastAPI service. Exposes a small API protected by a bearer
token. The panel calls it to install / configure / manage local proxy
services (Dante for SOCKS5, Squid for HTTP/S) and to add or remove proxy
users at runtime.

Configuration is read from /etc/proxyhub-agent/config.json:
    {
      "panel_url":         "https://panel.example.com",
      "enrollment_token":  "one-time token (used once at startup)",
      "agent_token":       "long-lived bearer token panel must present",
      "agent_url":         "https://this.vps.public.fqdn:7878",
      "agent_id":          "uuid issued by panel on first enroll (optional)"
    }

After successful enroll, "enrollment_token" is wiped and "agent_id" is set.
"""
from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import secrets
import socket
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

CONFIG_PATH = Path(os.environ.get("PROXYHUB_AGENT_CONFIG", "/etc/proxyhub-agent/config.json"))
SQUID_PASSWD = Path("/etc/squid/passwd")
SQUID_CONF = Path("/etc/squid/squid.conf")
DANTE_CONF = Path("/etc/danted.conf")
CONF_TPL_DIR = Path(os.environ.get("PROXYHUB_TPL_DIR", "/opt/proxyhub-agent/templates"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s - agent - %(levelname)s - %(message)s")
log = logging.getLogger("agent")

app = FastAPI(title="ProxyHub Agent", version="1.0.0")


# ---------- config helpers ----------
def load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text())
    except Exception:
        return {}


def save_config(cfg: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except Exception:
        pass


def require_token(authorization: Optional[str] = Header(default=None)) -> str:
    cfg = load_config()
    expected = cfg.get("agent_token")
    if not expected:
        raise HTTPException(status_code=503, detail="Agent not configured")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    return token


# ---------- shell helpers ----------
def sh(cmd: list[str], check: bool = False, capture: bool = True, input_text: str | None = None) -> subprocess.CompletedProcess:
    log.info("$ %s", " ".join(cmd))
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture,
        text=True,
        input=input_text,
    )


def which(prog: str) -> bool:
    return subprocess.run(["which", prog], capture_output=True, text=True).returncode == 0


def is_root() -> bool:
    return hasattr(os, "geteuid") and os.geteuid() == 0


# ---------- system inspection ----------
def list_interfaces() -> list[dict]:
    """Parse `ip -j addr show` into a list of {name, ipv4: [], ipv6: []}."""
    try:
        out = sh(["ip", "-j", "addr"], check=True)
        data = json.loads(out.stdout)
    except Exception as e:
        log.warning("ip -j addr failed: %s", e)
        return []
    result = []
    for iface in data:
        name = iface.get("ifname")
        ipv4, ipv6 = [], []
        for a in iface.get("addr_info") or []:
            fam = a.get("family")
            ip = a.get("local")
            if not ip:
                continue
            if fam == "inet":
                ipv4.append({"address": ip, "prefixlen": a.get("prefixlen")})
            elif fam == "inet6":
                ipv6.append({"address": ip, "prefixlen": a.get("prefixlen"), "scope": a.get("scope")})
        if name and name != "lo":
            result.append({"name": name, "ipv4": ipv4, "ipv6": ipv6, "operstate": iface.get("operstate")})
    return result


def detect_ipv6_subnet() -> Optional[str]:
    """Pick the first non-link-local global /64-ish subnet the host has."""
    for iface in list_interfaces():
        for a in iface["ipv6"]:
            if a.get("scope") == "global":
                try:
                    net = ipaddress.ip_network(f"{a['address']}/{a['prefixlen']}", strict=False)
                    return str(net)
                except Exception:
                    continue
    return None


def primary_ipv4() -> Optional[str]:
    for iface in list_interfaces():
        for a in iface["ipv4"]:
            if not a["address"].startswith(("127.", "10.", "172.", "192.168.")):
                return a["address"]
    # fallback to first non-loopback v4
    for iface in list_interfaces():
        if iface["ipv4"]:
            return iface["ipv4"][0]["address"]
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return None


def service_running(name: str) -> bool:
    """Return True if systemd reports the unit active, or, if systemctl isn't
    available, fall back to pgrep so container-style hosts also report correctly."""
    try:
        res = subprocess.run(["systemctl", "is-active", name], capture_output=True, text=True)
        if res.returncode == 0 and res.stdout.strip() == "active":
            return True
        if res.returncode == 0:
            return False
    except FileNotFoundError:
        pass
    # systemctl missing or unknown unit — try pgrep
    res = subprocess.run(["pgrep", "-x", name], capture_output=True, text=True)
    return res.returncode == 0


# ---------- models ----------
class InfoOut(BaseModel):
    hostname: str
    os: str
    is_root: bool
    primary_ipv4: Optional[str]
    ipv6_subnet: Optional[str]
    interfaces: list
    squid_installed: bool
    dante_installed: bool
    squid_running: bool
    dante_running: bool
    timestamp: str


class UserIn(BaseModel):
    username: str
    password: str
    proto: str = "http"  # "http" -> squid (htpasswd), "socks" -> dante (system user)


class GenerateIPv6In(BaseModel):
    count: int = 100
    port_start: int = 30000
    subnet: Optional[str] = None  # override detected /64
    interface: Optional[str] = None  # default: first non-loopback iface
    auth_user: Optional[str] = None
    auth_pass: Optional[str] = None
    protocol: str = "http"  # currently only http (Squid) supported for outbound v6 rotation


class GenerateIPv6Out(BaseModel):
    server_ipv4: str
    interface: str
    subnet: str
    proxies: List[dict]  # [{listen_port, outbound_ipv6}]


# ---------- routes ----------
@app.get("/agent/info", response_model=InfoOut)
def info(_: str = Depends(require_token)):
    return InfoOut(
        hostname=socket.gethostname(),
        os=" ".join(os.uname()) if hasattr(os, "uname") else sys.platform,
        is_root=is_root(),
        primary_ipv4=primary_ipv4(),
        ipv6_subnet=detect_ipv6_subnet(),
        interfaces=list_interfaces(),
        squid_installed=which("squid"),
        dante_installed=which("danted") or which("sockd"),
        squid_running=service_running("squid"),
        dante_running=service_running("danted"),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/agent/interfaces")
def interfaces(_: str = Depends(require_token)):
    return {"interfaces": list_interfaces(), "ipv6_subnet": detect_ipv6_subnet(), "primary_ipv4": primary_ipv4()}


@app.get("/agent/status")
def status(_: str = Depends(require_token)):
    # count proxy users
    squid_users = 0
    if SQUID_PASSWD.exists():
        squid_users = sum(1 for _ in SQUID_PASSWD.read_text().splitlines() if _.strip())
    return {
        "squid_running": service_running("squid"),
        "dante_running": service_running("danted"),
        "squid_users": squid_users,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/agent/install")
def install(_: str = Depends(require_token)):
    """Install Dante + Squid + apache2-utils. Idempotent."""
    if not is_root():
        raise HTTPException(status_code=400, detail="Agent must run as root to install packages")
    cmds = [
        ["apt-get", "update", "-y"],
        ["apt-get", "install", "-y", "squid", "dante-server", "apache2-utils", "iproute2"],
    ]
    output = []
    for c in cmds:
        r = sh(c)
        output.append({"cmd": " ".join(c), "rc": r.returncode, "stderr": r.stderr[-500:]})
        if r.returncode != 0:
            return {"ok": False, "logs": output}
    # baseline configs if not present
    _write_baseline_configs()
    sh(["systemctl", "enable", "--now", "squid"])
    sh(["systemctl", "enable", "--now", "danted"])
    return {"ok": True, "logs": output, "squid_running": service_running("squid"), "dante_running": service_running("danted")}


def _write_baseline_configs():
    """Drop minimal Dante + Squid configs if missing."""
    # squid baseline (auth required, single port 3128)
    if not SQUID_CONF.exists() or "proxyhub-baseline" not in SQUID_CONF.read_text():
        baseline = """# proxyhub-baseline
auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwd
auth_param basic realm proxyhub
acl authenticated proxy_auth REQUIRED
http_access allow authenticated
http_access deny all
http_port 3128
visible_hostname proxyhub
forwarded_for delete
via off
# managed-section
"""
        SQUID_CONF.parent.mkdir(parents=True, exist_ok=True)
        SQUID_CONF.write_text(baseline)
    if not SQUID_PASSWD.exists():
        SQUID_PASSWD.parent.mkdir(parents=True, exist_ok=True)
        SQUID_PASSWD.touch(mode=0o644)

    # dante baseline (single port 1080, pam auth -> system users)
    if not DANTE_CONF.exists() or "proxyhub-baseline" not in DANTE_CONF.read_text():
        nic = primary_ipv4() and _interface_for_ip(primary_ipv4()) or "eth0"
        dante = f"""# proxyhub-baseline
logoutput: /var/log/danted.log
internal: 0.0.0.0 port = 1080
external: {nic}
socksmethod: username
user.privileged: root
user.unprivileged: nobody
client pass {{
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect disconnect error
}}
socks pass {{
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect disconnect error
}}
"""
        DANTE_CONF.write_text(dante)


def _interface_for_ip(ip: str) -> Optional[str]:
    for iface in list_interfaces():
        for a in iface["ipv4"] + iface["ipv6"]:
            if a["address"] == ip:
                return iface["name"]
    return None


@app.post("/agent/users")
def add_user(payload: UserIn, _: str = Depends(require_token)):
    if not is_root():
        raise HTTPException(status_code=400, detail="Agent must run as root")
    if payload.proto == "http":
        SQUID_PASSWD.parent.mkdir(parents=True, exist_ok=True)
        flag = "-bc" if not SQUID_PASSWD.exists() else "-b"
        r = sh(["htpasswd", flag, str(SQUID_PASSWD), payload.username, payload.password])
        if r.returncode != 0:
            raise HTTPException(status_code=500, detail=r.stderr)
        sh(["systemctl", "reload", "squid"])
        return {"ok": True, "user": payload.username, "proto": "http"}

    if payload.proto == "socks":
        # create system user, set password, no shell
        sh(["useradd", "-M", "-s", "/usr/sbin/nologin", payload.username])
        r = sh(["chpasswd"], input_text=f"{payload.username}:{payload.password}\n")
        if r.returncode != 0:
            raise HTTPException(status_code=500, detail=r.stderr)
        return {"ok": True, "user": payload.username, "proto": "socks"}

    raise HTTPException(status_code=400, detail="Unknown proto")


@app.delete("/agent/users/{username}")
def remove_user(username: str, proto: str = "http", _: str = Depends(require_token)):
    if not is_root():
        raise HTTPException(status_code=400, detail="Agent must run as root")
    if proto == "http":
        if not SQUID_PASSWD.exists():
            return {"ok": True}
        sh(["htpasswd", "-D", str(SQUID_PASSWD), username])
        sh(["systemctl", "reload", "squid"])
        return {"ok": True}
    if proto == "socks":
        sh(["userdel", "-f", username])
        return {"ok": True}
    raise HTTPException(status_code=400, detail="Unknown proto")


@app.post("/agent/ipv6/add")
def ipv6_add(addresses: List[str], interface: str, _: str = Depends(require_token)):
    if not is_root():
        raise HTTPException(status_code=400, detail="Agent must run as root")
    added = []
    for ip in addresses:
        r = sh(["ip", "-6", "addr", "add", f"{ip}/128", "dev", interface])
        already = r.returncode != 0 and "exists" in (r.stderr or "").lower()
        added.append({
            "ip": ip,
            "rc": 0 if (r.returncode == 0 or already) else r.returncode,
            "already_present": already,
            "stderr": r.stderr.strip()[-120:],
        })
    return {"added": added}


@app.post("/agent/proxies/generate-ipv6", response_model=GenerateIPv6Out)
def generate_ipv6(payload: GenerateIPv6In, _: str = Depends(require_token)):
    """Generate N HTTP proxies (Squid) each bound to a unique outbound IPv6 from the subnet."""
    if not is_root():
        raise HTTPException(status_code=400, detail="Agent must run as root")
    if payload.protocol != "http":
        raise HTTPException(status_code=400, detail="Only HTTP (Squid) rotation supported in v1")

    subnet_str = payload.subnet or detect_ipv6_subnet()
    if not subnet_str:
        raise HTTPException(status_code=400, detail="No IPv6 subnet detected")
    try:
        subnet = ipaddress.ip_network(subnet_str, strict=False)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid subnet '{subnet_str}'")
    if not isinstance(subnet, ipaddress.IPv6Network):
        raise HTTPException(status_code=400, detail="Subnet must be IPv6")

    interface = payload.interface
    if not interface:
        for iface in list_interfaces():
            if iface["ipv6"] and iface["operstate"] != "DOWN":
                interface = iface["name"]
                break
    if not interface:
        raise HTTPException(status_code=400, detail="No usable network interface")

    # ensure baseline + auth user if asked
    _write_baseline_configs()
    if payload.auth_user and payload.auth_pass:
        flag = "-bc" if not SQUID_PASSWD.exists() else "-b"
        sh(["htpasswd", flag, str(SQUID_PASSWD), payload.auth_user, payload.auth_pass])

    # generate addresses + assign to interface
    addrs: list[str] = []
    seen = set()
    # random hosts inside the subnet, deterministic-ish ordering
    base_int = int(subnet.network_address)
    span = max(2, subnet.num_addresses - 2)
    while len(addrs) < payload.count and len(seen) < min(span, payload.count * 4):
        rand = secrets.randbelow(span - 1) + 1
        ip = str(ipaddress.IPv6Address(base_int + rand))
        if ip in seen:
            continue
        seen.add(ip)
        addrs.append(ip)
    for ip in addrs:
        sh(["ip", "-6", "addr", "add", f"{ip}/128", "dev", interface])

    # build squid managed block (replace anything between markers)
    conf = SQUID_CONF.read_text()
    lines = []
    rotations = []
    port = payload.port_start
    for ip in addrs:
        name = f"p{port}"
        # `name=` is REQUIRED so `myportname` ACL can match this specific listener
        lines.append(f"http_port {port} name={name}")
        lines.append(f"acl port_{port} myportname {name}")
        lines.append(f"tcp_outgoing_address {ip} port_{port}")
        rotations.append({"listen_port": port, "outbound_ipv6": ip})
        port += 1

    marker_start = "# --- proxyhub-managed-start ---"
    marker_end = "# --- proxyhub-managed-end ---"
    managed_block = "\n".join([marker_start, *lines, marker_end])
    if marker_start in conf and marker_end in conf:
        pre, _, rest = conf.partition(marker_start)
        _, _, post = rest.partition(marker_end)
        new_conf = pre + managed_block + post
    else:
        new_conf = conf.rstrip() + "\n\n" + managed_block + "\n"
    SQUID_CONF.write_text(new_conf)

    sh(["systemctl", "reload", "squid"]) if service_running("squid") else sh(["systemctl", "restart", "squid"])

    return GenerateIPv6Out(
        server_ipv4=primary_ipv4() or "",
        interface=interface,
        subnet=str(subnet),
        proxies=rotations,
    )


# ---------- enrollment ----------
async def attempt_enroll():
    """At startup, if config has an enrollment_token, register with the panel."""
    cfg = load_config()
    if not cfg.get("enrollment_token") or not cfg.get("panel_url"):
        return
    # build payload
    info_payload = {
        "enrollment_token": cfg["enrollment_token"],
        "agent_token": cfg["agent_token"],
        "agent_url": cfg.get("agent_url"),
        "hostname": socket.gethostname(),
        "public_ipv4": primary_ipv4(),
        "ipv6_subnet": detect_ipv6_subnet(),
        "interfaces": list_interfaces(),
    }
    url = cfg["panel_url"].rstrip("/") + "/api/servers/enroll"
    try:
        async with httpx.AsyncClient(verify=False, timeout=20.0) as client:
            r = await client.post(url, json=info_payload)
            if r.status_code >= 400:
                log.error("Enroll failed: %s %s", r.status_code, r.text[:300])
                return
            data = r.json()
            cfg["agent_id"] = data.get("server", {}).get("id")
            cfg.pop("enrollment_token", None)
            save_config(cfg)
            log.info("Enrolled successfully as %s", cfg["agent_id"])
    except Exception as e:
        log.exception("Enrollment error: %s", e)


@app.on_event("startup")
async def _startup():
    asyncio.create_task(attempt_enroll())


if __name__ == "__main__":
    import uvicorn

    cfg = load_config()
    host = "0.0.0.0"
    port = int(os.environ.get("AGENT_PORT", "7878"))
    cert = os.environ.get("AGENT_CERT", "/etc/proxyhub-agent/cert.pem")
    key = os.environ.get("AGENT_KEY", "/etc/proxyhub-agent/key.pem")
    if os.path.exists(cert) and os.path.exists(key):
        uvicorn.run(app, host=host, port=port, ssl_certfile=cert, ssl_keyfile=key)
    else:
        uvicorn.run(app, host=host, port=port)
