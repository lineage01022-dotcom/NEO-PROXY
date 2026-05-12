#!/usr/bin/env bash
# ProxyHub — one-line deploy on a fresh Linux VPS.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/<you>/proxyhub/main/deploy.sh | sudo bash
# Or after cloning:
#   sudo bash deploy.sh
#
# This script:
#   1. Installs Docker + docker compose plugin (if missing).
#   2. Generates a .env from .env.example with secure random JWT_SECRET.
#   3. Asks (or accepts via env) for PANEL_PUBLIC_URL and admin credentials.
#   4. Brings up the stack with `docker compose up -d --build`.
#   5. Opens firewall ports via ufw (best effort).
set -euo pipefail

step() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "    \033[1;32m✓\033[0m %s\n" "$*"; }
fail() { printf "    \033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Run as root: sudo bash deploy.sh"

REPO_DIR="${REPO_DIR:-$(pwd)}"
cd "$REPO_DIR"
[ -f docker-compose.yml ] || fail "docker-compose.yml not found in $REPO_DIR. Clone the repo first."

step "Installing Docker (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  ok "Docker installed"
else
  ok "Docker already present ($(docker --version))"
fi

if ! docker compose version >/dev/null 2>&1; then
  apt-get update -y >/dev/null
  apt-get install -y docker-compose-plugin >/dev/null
fi
ok "docker compose available"

step "Configuring environment"
if [ ! -f .env ]; then
  cp .env.example .env
  # Generate strong secret
  SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p -c 64)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env

  PANEL_PUBLIC_URL="${PANEL_PUBLIC_URL:-}"
  if [ -z "$PANEL_PUBLIC_URL" ]; then
    read -rp "Enter PANEL_PUBLIC_URL (e.g. https://panel.example.com): " PANEL_PUBLIC_URL
  fi
  [ -n "$PANEL_PUBLIC_URL" ] || fail "PANEL_PUBLIC_URL is required"
  sed -i "s|^PANEL_PUBLIC_URL=.*|PANEL_PUBLIC_URL=${PANEL_PUBLIC_URL}|" .env

  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@proxy.com}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=')}"
  sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL}|" .env
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" .env

  ok ".env generated"
  ok "Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}"
else
  ok ".env already exists — keeping current values"
fi

step "Building and starting containers"
docker compose pull --ignore-pull-failures >/dev/null 2>&1 || true
docker compose up -d --build
ok "Stack is up"

step "Opening firewall (best effort)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 3000/tcp || true
  ufw allow 8001/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ok "Allowed 80, 443, 3000, 8001"
else
  printf "    \033[1;33m!\033[0m ufw not installed — open ports 80/443 (or 3000/8001) manually.\n"
fi

PANEL_URL=$(grep "^PANEL_PUBLIC_URL=" .env | cut -d'=' -f2-)

cat <<EOF

\033[1;32m✓  Panel deployed.\033[0m

  URL              : ${PANEL_URL}
  Admin email      : $(grep ^ADMIN_EMAIL .env | cut -d'=' -f2-)
  Admin password   : $(grep ^ADMIN_PASSWORD .env | cut -d'=' -f2-)
  Container logs   : docker compose logs -f panel-backend
  Restart          : docker compose restart
  Tear down        : docker compose down  (add -v to wipe data)

Next: open ${PANEL_URL}, go to \033[1mServers → Add server\033[0m, paste the generated
bootstrap command on your Floxynet VPS. Then \033[1mGenerate IPv6 proxies\033[0m.

EOF
