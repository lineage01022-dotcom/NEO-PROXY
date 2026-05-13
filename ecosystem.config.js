// PM2 ecosystem for NEO PROXY (Linux VPS).
//
// Path-agnostic: cwd uses __dirname so this works whether you unzip to
// /opt/neo-proxy, /home/user/neo-proxy, /var/www/neo-proxy, etc.
//
// Quick start:
//   bash setup.sh          # installs python venv + node deps + builds frontend
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup

const path = require("path");
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: "neo-backend",
      cwd: path.join(ROOT, "backend"),
      script: path.join(ROOT, "backend", "venv", "bin", "uvicorn"),
      args: "server:app --host 0.0.0.0 --port 8001 --workers 1 --no-access-log",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      env: { PYTHONUNBUFFERED: "1" },
    },
    {
      name: "neo-frontend",
      cwd: path.join(ROOT, "frontend"),
      script: "npx",
      args: "serve -s build -l 3000",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
    },
    // OPTIONAL — uncomment if THIS host should also act as a proxy worker:
    // {
    //   name: "neo-agent",
    //   cwd: path.join(ROOT, "agent"),
    //   script: path.join(ROOT, "backend", "venv", "bin", "python"),
    //   args: "agent.py",
    //   interpreter: "none",
    //   autorestart: true,
    //   env: {
    //     PROXYHUB_AGENT_CONFIG: "/etc/proxyhub-agent/config.json",
    //     AGENT_PORT: "7878",
    //   },
    // },
  ],
};
