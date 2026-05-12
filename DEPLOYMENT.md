# ProxyHub — Floxynet Romania II Deployment Guide

> Optimized for a **2 GB / Flokinet Romania II VPS** at **185.146.233.197** with a `/64` IPv6 subnet.
> Total resident memory after `docker compose up`: **≈ 260–290 MB**.

---

## 1. RAM budget on this VPS

| Container         | Image                  | Hard limit | Typical RSS |
|-------------------|------------------------|-----------:|------------:|
| `panel-frontend`  | `nginx:1.27-alpine`    |       30 M |      ~12 M  |
| `panel-backend`   | `python:3.11-slim`     |      140 M |      ~75 M  |
| `mongo`           | `mongo:7-jammy` (cache cap 150 MB) | 180 M | ~140 M |
| `proxyhub-agent`  | Python venv on the host (systemd) |  ~50 M | ~25 M |
| **Total**         |                        |    **400 M ceiling** | **≈ 250 M** |

This leaves you ~1.4 GB free of your 2 GB for Squid + Dante + the IPv6 traffic itself.

---

## 2. Single command to deploy the panel on Floxynet

SSH in as **root** and run:

```bash
apt-get update -y && apt-get install -y git curl
git clone <your-repo-url> proxyhub && cd proxyhub
cp .env.example .env
# Edit .env — set JWT_SECRET (openssl rand -hex 32) and change ADMIN_PASSWORD.
nano .env
# PANEL_PUBLIC_URL=http://185.146.233.197 is already pre-set.

# install docker if missing, build images, start the stack
curl -fsSL https://get.docker.com | sh
docker compose up -d --build
```

Verify within ~60 s:

```bash
docker compose ps
docker stats --no-stream     # should show panel-frontend + backend + mongo well under 300 MB total
curl http://185.146.233.197/api/health
```

You can also use the bundled one-liner that installs Docker, generates a secure `.env`, and starts the stack:

```bash
sudo PANEL_PUBLIC_URL=http://185.146.233.197 bash deploy.sh
```

Login at **http://185.146.233.197** with the admin credentials shown at the end of the deploy.

---

## 3. UFW firewall — open these ports

```bash
sudo ufw allow 22/tcp                 # SSH (keep your existing rule)
sudo ufw allow 80/tcp                 # Panel UI + API (nginx proxies /api to backend)
sudo ufw allow 7878/tcp               # ProxyHub Agent (panel ↔ agent on this same box)
sudo ufw allow 3128/tcp               # Squid HTTP proxy listeners
sudo ufw allow 1080/tcp               # Dante SOCKS5
sudo ufw allow 30000:31000/tcp        # IPv6 rotation listen range (1000 ports for 1000 proxies)
sudo ufw --force enable
```

Tip: lock the Squid range to your own IP if you're the only consumer:
```bash
sudo ufw allow from <YOUR.HOME.IP> to any port 30000:31000 proto tcp
```

---

## 4. Run the Agent bootstrap

The agent runs on **the same VPS** as the panel (you only have one VPS). On a second VPS you'd repeat these steps.

1. Open the panel: **http://185.146.233.197** → log in as admin.
2. Go to **Servers → Add server** → name it `floxynet-ro-2` → click **Generate bootstrap command**.
3. Copy the line shown. It looks like this (token is one-time, 2-h expiry):

   ```bash
   curl -fsSL http://185.146.233.197/api/bootstrap/<TOKEN>/install.sh | sudo bash
   ```

4. Paste it in the SAME VPS's SSH session (you're already root). The installer will:
   - `apt-get install` **squid**, **dante-server**, **apache2-utils**, **iproute2**, **openssl**, **python3-venv**
   - Drop the agent at `/opt/proxyhub-agent`
   - Generate a self-signed TLS cert + a 64-char bearer token
   - Install the `proxyhub-agent.service` systemd unit on port **7878**
   - Call the panel back at `http://185.146.233.197/api/servers/enroll`

5. ~10 s later the server flips to **Online** in the Servers tab. Open it → **Generate IPv6 proxies** → **count=1000, port_start=30000, leave subnet blank** → click Generate. Done.

   The 1,000 entries land in your **Proxy List** tagged `hosted, ipv6-rotation`.

Verify one from your laptop:
```bash
curl -x http://USER:PASS@185.146.233.197:30000 https://api.ipify.org
# returns the rotated IPv6 — proves outbound rotation is working
```

---

## 5. Useful one-liners

```bash
# Show live memory per container
docker stats

# Tail panel backend logs
docker compose logs -f panel-backend

# Tail agent logs
journalctl -u proxyhub-agent -f

# Re-issue an enrollment token if the agent didn't register cleanly
# (Panel → Servers → Add server again — the old token still expires after 2 h)

# Reload Squid after manual edits (NOT needed for IPv6 generation — agent does it)
systemctl reload squid

# Restart the panel stack
docker compose restart

# Tear down (keep data)
docker compose down
```

---

## 6. After it's running — recommended next steps

- Put **nginx + Let's Encrypt** in front so the panel runs on `https://`. Then remove `verify=False` in `backend/agent_client.py`.
- Restrict :7878 to localhost since the agent runs on the same box:
  ```bash
  sudo ufw delete allow 7878/tcp
  ```
  and the panel still reaches it via `http://localhost:7878` if you point the agent_url that way in the admin DB.
- Add a swap file for safety (2 GB is tight):
  ```bash
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  ```
