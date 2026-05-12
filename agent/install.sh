#!/usr/bin/env bash
# ProxyHub Agent bootstrap installer.
# This file is rendered by the panel at:
#   GET /api/bootstrap/{enrollment_token}/install.sh
# and is meant to be piped to bash, e.g.:
#   curl -fsSL https://panel.example.com/api/bootstrap/<TOKEN>/install.sh | sudo bash
#
# Variables baked in at render time:
#   __PANEL_URL__         - https URL of the panel
#   __ENROLLMENT_TOKEN__  - one-time enrollment token
#   __AGENT_PORT__        - default 7878
set -euo pipefail

PANEL_URL="__PANEL_URL__"
ENROLLMENT_TOKEN="__ENROLLMENT_TOKEN__"
AGENT_PORT="__AGENT_PORT__"

# resolve binaries
need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "[!] This installer must be run as root." >&2
    exit 1
  fi
}

step() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "    \033[1;32m✓\033[0m %s\n" "$*"; }
fail() { printf "    \033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }

need_root

step "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y \
  squid dante-server apache2-utils \
  python3 python3-pip python3-venv \
  iproute2 openssl curl ca-certificates >/dev/null
ok "Packages installed"

step "Creating /opt/proxyhub-agent"
install -d -m 0755 /opt/proxyhub-agent /opt/proxyhub-agent/templates /etc/proxyhub-agent

step "Downloading agent code"
curl -fsSL "$PANEL_URL/api/bootstrap/agent.py" -o /opt/proxyhub-agent/agent.py
curl -fsSL "$PANEL_URL/api/bootstrap/squid.conf.tpl" -o /opt/proxyhub-agent/templates/squid.conf.tpl || true
curl -fsSL "$PANEL_URL/api/bootstrap/dante.conf.tpl" -o /opt/proxyhub-agent/templates/dante.conf.tpl || true
ok "Agent code in place"

step "Creating Python venv + installing dependencies"
python3 -m venv /opt/proxyhub-agent/venv
/opt/proxyhub-agent/venv/bin/pip install --upgrade pip wheel >/dev/null
/opt/proxyhub-agent/venv/bin/pip install fastapi==0.110.1 uvicorn==0.25.0 httpx==0.28.1 pydantic==2.7.4 >/dev/null
ok "Python dependencies installed"

step "Generating self-signed TLS cert (valid 10 years)"
HOST_FQDN="$(hostname -f 2>/dev/null || hostname)"
PUBLIC_IP="$(curl -fsSL https://api.ipify.org 2>/dev/null || true)"
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout /etc/proxyhub-agent/key.pem \
  -out    /etc/proxyhub-agent/cert.pem \
  -subj   "/CN=${HOST_FQDN}" \
  -addext "subjectAltName=DNS:${HOST_FQDN}${PUBLIC_IP:+,IP:${PUBLIC_IP}}" >/dev/null 2>&1
chmod 600 /etc/proxyhub-agent/key.pem
ok "Certificate at /etc/proxyhub-agent/cert.pem"

step "Generating agent bearer token"
AGENT_TOKEN="$(openssl rand -hex 32)"
AGENT_URL_HOST="${PUBLIC_IP:-$HOST_FQDN}"
AGENT_URL="https://${AGENT_URL_HOST}:${AGENT_PORT}"

cat >/etc/proxyhub-agent/config.json <<JSON
{
  "panel_url":        "${PANEL_URL}",
  "enrollment_token": "${ENROLLMENT_TOKEN}",
  "agent_token":      "${AGENT_TOKEN}",
  "agent_url":        "${AGENT_URL}"
}
JSON
chmod 600 /etc/proxyhub-agent/config.json
ok "Config written to /etc/proxyhub-agent/config.json"

step "Installing systemd service"
cat >/etc/systemd/system/proxyhub-agent.service <<UNIT
[Unit]
Description=ProxyHub Agent
After=network.target

[Service]
Type=simple
Environment=PROXYHUB_AGENT_CONFIG=/etc/proxyhub-agent/config.json
Environment=AGENT_PORT=${AGENT_PORT}
Environment=AGENT_CERT=/etc/proxyhub-agent/cert.pem
Environment=AGENT_KEY=/etc/proxyhub-agent/key.pem
ExecStart=/opt/proxyhub-agent/venv/bin/python /opt/proxyhub-agent/agent.py
Restart=on-failure
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now proxyhub-agent.service
sleep 2
systemctl is-active --quiet proxyhub-agent && ok "Agent is running" || fail "Agent failed to start. Check: journalctl -u proxyhub-agent -e"

step "Opening firewall (best effort)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow "${AGENT_PORT}/tcp" || true
  ufw allow 3128/tcp || true
  ufw allow 1080/tcp || true
fi

cat <<DONE

\033[1;32m✓  ProxyHub Agent installed and enrolled.\033[0m

  Agent URL    : ${AGENT_URL}
  Bearer token : (stored in /etc/proxyhub-agent/config.json, never leaves the server)
  Logs         : journalctl -u proxyhub-agent -f
  Services     : squid (HTTP :3128), danted (SOCKS5 :1080)

Open the panel — your new server should appear in the Servers tab within ~10 seconds.

DONE
