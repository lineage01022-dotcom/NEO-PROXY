import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Server, RefreshCw, Trash2, Copy, Check, X, Loader2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

function StatusPill({ status }) {
  const map = {
    online: { dot: "bg-emerald-400", cls: "status-active", label: "Online" },
    offline: { dot: "bg-red-400", cls: "status-dead", label: "Offline" },
    unknown: { dot: "bg-zinc-400", cls: "status-unknown", label: "Unknown" },
  };
  const s = map[status] || map.unknown;
  return (
    <span className={`status-badge ${s.cls}`}>
      <span className={`status-dot ${s.dot}`} />
      {s.label}
    </span>
  );
}

function CopyBox({ value, testid }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Copied");
    } catch {
      toast.error("Clipboard blocked — select and copy manually");
    }
  };
  return (
    <div className="relative">
      <pre
        className="mono text-[11px] bg-[#070912] border border-white/5 rounded-xl p-3 pr-20 overflow-x-auto whitespace-pre-wrap break-all"
        data-testid={testid}
      >
        {value}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 px-2 py-1 rounded-md border border-white/10 hover:bg-white/5 text-[11px] flex items-center gap-1"
        data-testid={`${testid}-copy`}
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        Copy
      </button>
    </div>
  );
}

function AddServerModal({ open, onClose, onAdded }) {
  const [name, setName] = useState("");
  const [agentPort, setAgentPort] = useState(7878);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  if (!open) return null;

  const reset = () => { setName(""); setAgentPort(7878); setCreated(null); };
  const close = () => { reset(); onClose(); };

  const create = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const { data } = await api.post("/servers/enrollment-tokens", { name: name.trim(), agent_port: agentPort });
      setCreated(data);
      onAdded?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/80 backdrop-blur-[12px] p-4">
      <div className="glass-card rounded-[24px] w-full max-w-2xl p-7 relative" data-testid="add-server-modal">
        <button onClick={close} className="absolute top-4 right-4 text-zinc-400 hover:text-white" data-testid="close-add-server">
          <X className="w-5 h-5" />
        </button>

        {!created ? (
          <>
            <h2 className="text-lg font-semibold mb-1">Add new server</h2>
            <p className="text-xs text-zinc-500 mb-6">
              We'll mint a one-time enrollment token. Run the generated command on your Ubuntu VPS to install the agent.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-zinc-400">Server name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="floxynet-de-1"
                  className="glass-input px-3 py-2.5 text-sm"
                  data-testid="server-name-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-zinc-400">Agent port</label>
                <input
                  type="number"
                  value={agentPort}
                  onChange={(e) => setAgentPort(parseInt(e.target.value || "7878", 10))}
                  className="glass-input px-3 py-2.5 text-sm"
                  data-testid="agent-port-input"
                />
              </div>
            </div>
            <button onClick={create} disabled={creating} className="btn-gradient w-full mt-6 py-3 text-sm flex items-center justify-center gap-2" data-testid="generate-bootstrap-btn">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />} Generate bootstrap command
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-1">SSH into your VPS and run this</h2>
            <p className="text-xs text-zinc-500 mb-5">
              Token expires in 2 hours. Once the agent installs and registers, the server appears in the list automatically (refresh in ~10s).
            </p>
            <div className="flex flex-col gap-3">
              <CopyBox value={created.bootstrap_command} testid="bootstrap-cmd" />
              <details className="text-xs text-zinc-400">
                <summary className="cursor-pointer hover:text-white">Show enrollment details</summary>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase text-zinc-500">Name</div>
                      <div className="mono text-zinc-300">{created.name}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-zinc-500">Agent port</div>
                      <div className="mono text-zinc-300">{created.agent_port}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-zinc-500">Panel URL</div>
                      <div className="mono text-zinc-300 break-all">{created.panel_url}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-zinc-500">Token expires</div>
                      <div className="mono text-zinc-300">{new Date(created.expires_at).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </details>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={reset} className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm" data-testid="generate-another-btn">
                  Generate another
                </button>
                <button onClick={close} className="btn-gradient px-5 py-2.5 text-sm" data-testid="finish-add-server-btn">
                  Done
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Servers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get("/servers");
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const remove = async (id) => {
    if (!window.confirm("Delete this server? Hosted proxies tied to it will also be removed.")) return;
    await api.delete(`/servers/${id}`);
    toast.success("Server removed");
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">Infrastructure</p>
          <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Servers</h1>
          <p className="text-sm text-zinc-400 mt-2">VPS workers that host your generated proxies. Connect via one-line bootstrap.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-gradient px-4 py-2.5 text-sm flex items-center gap-2" data-testid="add-server-btn">
          <Plus className="w-4 h-4" /> Add server
        </button>
      </header>

      <div className="glass-card rounded-[20px] overflow-hidden">
        <table className="w-full text-sm" data-testid="servers-table">
          <thead className="bg-white/[0.02]">
            <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="text-left p-3 pl-5">Name</th>
              <th className="text-left p-3">Hostname</th>
              <th className="text-left p-3">Public IPv4</th>
              <th className="text-left p-3">IPv6 subnet</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Last seen</th>
              <th className="text-right p-3 pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-10 text-center text-zinc-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-zinc-500">
                  <Server className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
                  No servers yet. Click <span className="text-zinc-300">Add server</span> to enroll your Floxynet VPS.
                </td>
              </tr>
            ) : items.map((s) => (
              <tr key={s.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => navigate(`/servers/${s.id}`)} data-testid={`server-row-${s.id}`}>
                <td className="p-3 pl-5 font-medium">{s.name}</td>
                <td className="p-3 text-zinc-300 mono text-xs">{s.hostname || "—"}</td>
                <td className="p-3 mono text-xs text-zinc-300">{s.public_ipv4 || "—"}</td>
                <td className="p-3 mono text-xs text-zinc-300">{s.ipv6_subnet || "—"}</td>
                <td className="p-3">
                  <StatusPill status={s.status} />
                </td>
                <td className="p-3 text-zinc-500 text-xs">{s.last_seen ? new Date(s.last_seen).toLocaleString() : "Never"}</td>
                <td className="p-3 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => remove(s.id)}
                    className="w-8 h-8 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 inline-flex items-center justify-center text-zinc-400 hover:text-red-300"
                    data-testid={`delete-server-${s.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddServerModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={load} />
    </div>
  );
}
