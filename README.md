# ProxyHub — self-hosted IPv6 proxy panel

> A production-ready proxy control panel. Spin up **1,000+ IPv6-rotated proxies** from a single VPS, manage them through a clean dashboard, and consume them in your blogging / scraping / automation scripts via a token-protected API.

![dashboard](docs/screenshot-dashboard.png)

---

## ✨ What's inside

| Layer        | Tech                                                  |
|--------------|-------------------------------------------------------|
| Frontend     | React 19 · Tailwind · shadcn/ui · recharts            |
| Backend      | FastAPI · Motor (async MongoDB) · PyJWT · bcrypt · httpx |
| Agent (VPS)  | FastAPI (single file) · systemd · self-signed TLS     |
| Proxy stack  | **Squid** (HTTP + IPv6 rotation) · **Dante** (SOCKS5) |
| Health check | Async worker — every proxy probed through itself / 10 min |

Key features:
- **Multi-server** — connect unlimited VPS workers, each shows up live in the panel.
- **Real IPv6 rotation** — `ip -6 addr add` + Squid `tcp_outgoing_address` keyed by named `http_port`, one outbound IPv6 per listen port.
- **Bulk import / export** — paste in `host:port:user:pass` lines, export JSON or TXT.
- **API for your scripts** — generate API keys, fetch active proxies via `/api/v1/active`.
- **Brute-force-resistant auth** — JWT cookies + bcrypt + lockout after 5 fails / 15 min.

---

## 🚀 Deploy on a fresh VPS (60 seconds)

### Option A — one liner
```bash
git clone <your-repo-url> proxyhub && cd proxyhub
sudo PANEL_PUBLIC_URL=https://panel.example.com bash deploy.sh
```

### Option B — step by step
```bash
git clone <your-repo-url> proxyhub
cd proxyhub
cp .env.example .env
# Edit .env — set PANEL_PUBLIC_URL and (optionally) admin creds
nano .env
docker compose up -d --build
```

After ~60 s the panel is live at `PANEL_PUBLIC_URL`. Log in with the admin email/password from `.env`.

**Firewall (UFW) — open on the panel host:**
```bash
sudo ufw allow 80/tcp     # HTTP (if you front with nginx + Let's Encrypt)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 3000/tcp   # React UI (only if accessed directly)
sudo ufw allow 8001/tcp   # FastAPI backend (only if accessed directly)
```

> **Production tip:** put nginx + certbot in front of `:3000` (UI) and `:8001/api` (backend) and only expose `80/443` publicly.

---

## 🔌 Enroll your Floxynet VPS

1. Open the panel → **Servers → Add server** → set a name → **Generate bootstrap command**.
2. SSH into your Floxynet VPS as **root** and paste:
   ```bash
   curl -fsSL https://<panel-url>/api/bootstrap/<TOKEN>/install.sh | sudo bash
   ```
   This installer:
   - `apt-get install` **squid · dante-server · apache2-utils · iproute2**
   - Drops the agent into `/opt/proxyhub-agent`
   - Generates a self-signed TLS cert + a bearer token (kept on the VPS, never travels)
   - Installs the `proxyhub-agent.service` systemd unit on **:7878**
   - Calls the panel back and registers itself
3. Within ~10 s the server flips to **Online** in the panel.

**Firewall (UFW) — open on the Floxynet VPS:**
```bash
sudo ufw allow 7878/tcp           # agent (panel ↔ agent)
sudo ufw allow 3128/tcp           # Squid (HTTP proxy)
sudo ufw allow 1080/tcp           # Dante (SOCKS5)
sudo ufw allow 30000:31000/tcp    # IPv6-rotation listen range
```

---

## 🌐 Generate 1,000 IPv6 proxies

1. Panel → **Servers → \<your-server\>** → **Generate IPv6 proxies**.
2. `count = 1000`, `port_start = 30000`. Leave subnet blank to auto-detect your `/64`.
3. Click **Generate**. The agent:
   - Picks 1,000 random addresses inside your `/64`
   - `ip -6 addr add <addr>/128 dev <iface>` each one
   - Appends 1,000 `http_port <port> name=p<port>` + `tcp_outgoing_address` lines to `/etc/squid/squid.conf`
   - Reloads Squid

The 1,000 entries land in your **Proxy List** tagged `hosted, ipv6-rotation` and are immediately consumable:

```bash
curl -H "X-API-Key: $YOUR_API_KEY" \
  "https://<panel-url>/api/v1/active?format=txt&protocol=http"
# 203.0.113.10:30000:user:pass
# 203.0.113.10:30001:user:pass
# ...
```

Test one from the CLI:
```bash
curl -x http://USER:PASS@<VPS_IPV4>:30000 https://api.ipify.org
# returns the rotated IPv6 — proving the outbound IP rotated
```

---

## 🗂  Project layout

```
proxyhub/
├── backend/        # FastAPI panel API
├── frontend/       # React UI
├── agent/          # VPS agent (single file) + install.sh + conf templates
├── docker-compose.yml
├── .env.example
├── deploy.sh       # one-liner installer for the panel host
├── DEPLOYMENT.md   # extended docs
└── README.md
```

---

## 🔐 Credentials & secrets

- `/app/memory/test_credentials.md` holds the seeded admin user.
- Agent bearer tokens **never leave the VPS** — only the panel stores its copy (in MongoDB).
- Self-signed certs are generated on each agent at install time. For real production, terminate with nginx + Let's Encrypt and remove `verify=False` in `backend/agent_client.py`.

---

## 🩺 Useful commands

| Action                                   | Command                                                |
|------------------------------------------|--------------------------------------------------------|
| Tail panel backend logs                  | `docker compose logs -f panel-backend`                 |
| Restart the stack                        | `docker compose restart`                               |
| Tear down (keep data)                    | `docker compose down`                                  |
| Tear down (wipe Mongo)                   | `docker compose down -v`                               |
| Tail agent logs on a VPS                 | `journalctl -u proxyhub-agent -f`                      |
| Manually reload Squid after edits        | `systemctl reload squid`                               |
| Test one proxy                           | `curl -x http://USER:PASS@VPS:30000 https://api.ipify.org` |

---

## 📜 License

MIT — do whatever you want with it. Self-host responsibly.
