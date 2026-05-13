# NEO PROXY — PM2 Deployment Guide (Linux VPS)

This is the **non-Docker** path. Everything runs as native processes managed
by PM2. Pick this if you prefer not to use docker-compose.

---

## 0. Prereqs (one-time, as root)

```bash
apt update
apt install -y python3 python3-venv python3-pip nodejs npm git curl
npm install -g yarn pm2
```

MongoDB — easiest option:
```bash
apt install -y mongodb
systemctl enable --now mongodb
```
(Or run your existing Mongo on another host and point `MONGO_URL` at it.)

---

## 1. Drop the code on the VPS

```bash
cd /opt
# Option A — git
git clone https://github.com/<you>/neo-proxy.git
cd neo-proxy

# Option B — scp / unzip the release zip
mkdir -p /opt/neo-proxy && cd /opt/neo-proxy
# scp neo-proxy.zip root@vps:/opt/   then:
unzip /opt/neo-proxy.zip -d /opt/neo-proxy
```

You should now have `/opt/neo-proxy/backend`, `/opt/neo-proxy/frontend`,
`/opt/neo-proxy/agent`, and `ecosystem.config.js` at the root.

---

## 2. Configure `.env`

```bash
cp /opt/neo-proxy/.env.example /opt/neo-proxy/backend/.env
nano /opt/neo-proxy/backend/.env       # fill in JWT_SECRET, ADMIN_*, etc.
chmod 600 /opt/neo-proxy/backend/.env
```

Generate a strong `JWT_SECRET`:
```bash
openssl rand -hex 32
```

---

## 3. Install backend deps

```bash
cd /opt/neo-proxy/backend
python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt
```

Smoke-test:
```bash
venv/bin/python -c "import server; print('OK')"
```

---

## 4. Build the frontend

The `REACT_APP_BACKEND_URL` is baked into the bundle at build time, so set it
**before** `yarn build`:

```bash
cd /opt/neo-proxy/frontend
echo "REACT_APP_BACKEND_URL=https://panel.yourdomain.com" > .env
yarn install
yarn build
```
(Or use `http://<VPS_IP>` if you don't have a domain yet.)

---

## 5. Launch with PM2

```bash
cd /opt/neo-proxy
pm2 start ecosystem.config.js
pm2 save                    # persist the process list
pm2 startup systemd         # follow the printed command to enable boot-start
```

Check it's alive:
```bash
pm2 status
pm2 logs neo-backend --lines 50
curl http://localhost:8001/api/health   # → {"status":"healthy"}
curl http://localhost:3000              # → React HTML
```

---

## 6. Put nginx (or Caddy) in front for HTTPS

Quick nginx + certbot path:

```bash
apt install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/neo-proxy <<'NGINX'
server {
    listen 80;
    server_name panel.yourdomain.com;
    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/neo-proxy /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d panel.yourdomain.com   # auto-issues + reloads
```

Open the firewall:
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## 7. Day-to-day PM2

| Want to…                  | Command                                        |
|---------------------------|------------------------------------------------|
| See all processes         | `pm2 status`                                   |
| Tail logs                 | `pm2 logs neo-backend` / `pm2 logs neo-frontend` |
| Restart after code update | `pm2 restart neo-backend`                      |
| Rebuild frontend          | `cd frontend && yarn build && pm2 restart neo-frontend` |
| Stop everything           | `pm2 stop all`                                 |
| Remove from PM2           | `pm2 delete all && pm2 save`                   |

---

## 8. Updating the code later

```bash
cd /opt/neo-proxy
git pull
cd backend && venv/bin/pip install -r requirements.txt && cd ..
cd frontend && yarn install && yarn build && cd ..
pm2 restart neo-backend neo-frontend
```

---

## Troubleshooting

- **`ModuleNotFoundError: No module named 'dotenv'`** → you skipped `pip install -r requirements.txt`, or PM2 is launching the wrong Python. Make sure `ecosystem.config.js` points at `./venv/bin/uvicorn` (it does by default).
- **`KeyError: 'JWT_SECRET'`** at login time → `.env` is missing or not in `/opt/neo-proxy/backend/`. server.py only reads from `backend/.env`.
- **Frontend shows blank** → you forgot `yarn build`, or `REACT_APP_BACKEND_URL` was wrong at build time. Rebuild and `pm2 restart neo-frontend`.
- **CORS errors in browser console** → set `CORS_ORIGINS=https://panel.yourdomain.com` in `backend/.env` and `pm2 restart neo-backend`.
