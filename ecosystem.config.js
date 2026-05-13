// PM2 ecosystem for NEO PROXY (Linux VPS).
//
//   Usage:
//     # one-time setup (see PM2_DEPLOY.md for full guide)
//     cd /opt/neo-proxy/backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt
//     cd /opt/neo-proxy/frontend && yarn install && yarn build
//
//     # start everything
//     pm2 start ecosystem.config.js
//     pm2 save && pm2 startup    # auto-start on reboot
//
//   Single source of truth for env values is /opt/neo-proxy/backend/.env
//   (loaded by server.py via python-dotenv). PM2 itself doesn't need to know.

module.exports = {
  apps: [
    {
      name: "neo-backend",
      cwd: "/opt/neo-proxy/backend",
      // Use the venv's uvicorn so PATH/python is correct.
      script: "./venv/bin/uvicorn",
      args: "server:app --host 0.0.0.0 --port 8001 --workers 1 --no-access-log",
      interpreter: "none",            // tell PM2 not to wrap with node/python
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
    {
      name: "neo-frontend",
      cwd: "/opt/neo-proxy/frontend",
      // Serves the static React build on :3000. Run `yarn build` first.
      // `serve` is installed automatically via `npx`, no global install needed.
      script: "npx",
      args: "serve -s build -l 3000",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
    },
    // OPTIONAL: only enable on a VPS that should also act as a proxy worker.
    // Comment out / remove if the panel host is purely a control panel.
    // {
    //   name: "neo-agent",
    //   cwd: "/opt/neo-proxy/agent",
    //   script: "/opt/neo-proxy/backend/venv/bin/python",
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
