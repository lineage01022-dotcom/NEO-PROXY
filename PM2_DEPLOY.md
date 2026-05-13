# NEO PROXY — VPS Deployment (PM2, no Docker required)

For Floxynet, CyberPanel, DigitalOcean, Hetzner, or any plain Linux box.

---

## TL;DR (5 commands)

```bash
# inside /opt/neo-proxy (or wherever you unzipped):
cp .env.example backend/.env && nano backend/.env             # secrets
cp frontend/.env.example frontend/.env && nano frontend/.env  # set REACT_APP_BACKEND_URL
bash setup.sh                                                 # installs deps + builds
npm i -g pm2 && pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

That's the whole thing. Read on for the fully-narrated version.

---

## 0. VPS prerequisites (one-time, as root)

```bash
apt update
apt install -y python3 python3-venv python3-pip nodejs npm git curl unzip
npm install -g yarn pm2
```

MongoDB on the same VPS (simplest):
```bash
apt install -y mongodb
systemctl enable --now mongodb
```
(Or point `MONGO_URL` at an external Mongo — see step 2.)

---

## 1. Get the code on the VPS

### CyberPanel File Manager flow
1. Download `neo-proxy.zip` from your GitHub repo's "Code → Download ZIP".
2. In CyberPanel, open **File Manager** for your domain, upload `neo-proxy.zip`,
   then click **Extract**. Note the absolute path it lives at — e.g.
   `/home/yourdomain.com/public_html/neo-proxy`. PM2 will work from any path.
3. Open the built-in **Terminal** (CyberPanel → top right) and `cd` into that folder.

### SSH flow
```bash
cd /opt
git clone https://github.com/<you>/neo-proxy.git
cd neo-proxy
```

---

## 2. Configure `backend/.env`

```bash
cp .env.example backend/.env
nano backend/.env
```
Fill in:
- `JWT_SECRET` — `openssl rand -hex 32`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — your admin login
- `PANEL_PUBLIC_URL` — `https://panel.yourdomain.com` or `http://<VPS_IP>`
- `CORS_ORIGINS` — same as `PANEL_PUBLIC_URL`
- `MONGO_URL` — leave as `mongodb://localhost:27017` if you installed Mongo locally

```bash
chmod 600 backend/.env
```

---

## 3. Configure `frontend/.env` (**important — baked into build**)

```bash
cp frontend/.env.example frontend/.env
nano frontend/.env
```
Set exactly one value:
```
REACT_APP_BACKEND_URL=https://panel.yourdomain.com
```
No trailing slash. Use `http://<VPS_IP>` if you don't have a domain yet.

> ⚠️ If you skip this, the React UI will be built with an empty/wrong URL and the browser will get CORS / 404 errors. If you ever change the URL later, you must re-run `yarn build`.

---

## 4. Install + build

```bash
bash setup.sh
```
This:
- Creates `backend/venv` and installs Python deps
- Smoke-tests `import server`
- Runs `yarn install` and `yarn build` in `frontend/`

Takes ~2-4 minutes on first run.

---

## 5. Launch with PM2

```bash
pm2 start ecosystem.config.js
pm2 save                  # persist process list
pm2 startup systemd       # follow the printed command to enable boot-start
pm2 status
```

Verify:
```bash
curl http://localhost:8001/api/health   # → {"status":"healthy"}
curl -I http://localhost:3000           # → 200 OK
```

---

## 6. Put nginx (or CyberPanel) in front for HTTPS

### CyberPanel-native (recommended on CyberPanel boxes)

CyberPanel → Websites → your domain → **vHost Conf** and add inside the `server { … }` block:

```nginx
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
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
Save → CyberPanel auto-reloads OpenLiteSpeed/nginx. Then **Issue SSL** for that domain in CyberPanel UI.

### Plain nginx
```bash
apt install -y nginx certbot python3-certbot-nginx
# (full Caddyfile / nginx config — see this same block in `DEPLOYMENT.md`)
certbot --nginx -d panel.yourdomain.com
```

### Open firewall
```bash
ufw allow 22/tcp 80/tcp 443/tcp
ufw --force enable
```

---

## 7. First login & wallets

1. Open `https://panel.yourdomain.com` → log in with the admin creds from `backend/.env`.
2. **Admin → Wallets** → paste real TRC-20 / BEP-20 USDT addresses + upload QR images.
3. **Servers → Add server** → run the printed `curl … | sudo bash` on each Floxynet worker.
4. **Servers → \<your-server\> → Generate IPv6 proxies** → 1000 in one click.

---

## Updating the code later

```bash
cd /opt/neo-proxy
git pull                       # or re-upload + extract the new zip
bash setup.sh                  # re-installs deps and rebuilds frontend
pm2 restart neo-backend neo-frontend
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pm2 logs neo-backend` shows `ModuleNotFoundError: No module named 'dotenv'` | Skipped `setup.sh` — run `cd backend && venv/bin/pip install -r requirements.txt` |
| `pm2 logs neo-backend` shows `KeyError: 'JWT_SECRET'` (only on login) | `backend/.env` is missing or `JWT_SECRET=` is blank |
| UI loads but every API call is 404 / CORS error | `frontend/.env` had the wrong URL when you built. Fix `.env` → `yarn build` → `pm2 restart neo-frontend` |
| `pm2 logs neo-frontend` says `serve: command not found` | `npx` will fetch it automatically on first run. If still broken, `npm i -g serve` |
| Browser says "Mixed content blocked" | You put `http://` in `REACT_APP_BACKEND_URL` but the site is served via HTTPS. Use `https://` and rebuild. |
| Mongo connection refused | `systemctl status mongodb` — start it. Or change `MONGO_URL` to a remote Atlas URL. |

---

## Day-to-day PM2

| Want to…                  | Command                                        |
|---------------------------|------------------------------------------------|
| All processes             | `pm2 status`                                   |
| Backend logs              | `pm2 logs neo-backend`                         |
| Frontend logs             | `pm2 logs neo-frontend`                        |
| Restart after config edit | `pm2 restart neo-backend`                      |
| Rebuild frontend          | `cd frontend && yarn build && pm2 restart neo-frontend` |
| Stop everything           | `pm2 stop all`                                 |
| Remove from PM2           | `pm2 delete all && pm2 save`                   |
