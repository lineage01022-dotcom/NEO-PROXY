#!/usr/bin/env bash
# NEO PROXY — one-shot installer.
# Run from the project root AFTER unzipping (e.g. /opt/neo-proxy or wherever).
#
#   cp .env.example backend/.env && nano backend/.env       # fill secrets
#   cp frontend/.env.example frontend/.env && nano frontend/.env   # set REACT_APP_BACKEND_URL
#   bash setup.sh
#   pm2 start ecosystem.config.js && pm2 save

set -e
ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$ROOT"

step() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "    \033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "    \033[1;33m!\033[0m %s\n" "$*"; }
die()  { printf "    \033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }

# ---- preflight -------------------------------------------------------------
step "Preflight"
command -v python3 >/dev/null || die "python3 not installed (apt install python3 python3-venv python3-pip)"
command -v node    >/dev/null || die "node not installed (apt install nodejs npm)"
command -v yarn    >/dev/null || die "yarn not installed (npm i -g yarn)"
command -v pm2     >/dev/null || warn "pm2 not installed yet (npm i -g pm2 once setup.sh finishes)"

[ -f "$ROOT/backend/.env" ]      || warn "backend/.env missing — copy from .env.example and fill it in"
[ -f "$ROOT/frontend/.env" ]     || warn "frontend/.env missing — copy from frontend/.env.example and set REACT_APP_BACKEND_URL"
ok "Tools present"

# ---- backend ---------------------------------------------------------------
step "Backend — venv + dependencies"
cd "$ROOT/backend"
if [ ! -d venv ]; then
  python3 -m venv venv
  ok "Created venv"
fi
venv/bin/pip install --upgrade pip --quiet
venv/bin/pip install -r requirements.txt --quiet
ok "Backend deps installed"
venv/bin/python -c "import server" && ok "server.py imports cleanly"

# ---- frontend --------------------------------------------------------------
step "Frontend — install + production build"
cd "$ROOT/frontend"
yarn install --silent
ok "node_modules installed"

if [ ! -f .env ]; then
  warn "frontend/.env is missing — build will use empty REACT_APP_BACKEND_URL (UI will fail to call the API!)"
fi
yarn build
ok "Production build emitted to frontend/build"

cd "$ROOT"
step "Done"
echo "Next:"
echo "  1. (if not already)  npm i -g pm2"
echo "  2.                   pm2 start ecosystem.config.js"
echo "  3.                   pm2 save && pm2 startup    # auto-start on reboot"
