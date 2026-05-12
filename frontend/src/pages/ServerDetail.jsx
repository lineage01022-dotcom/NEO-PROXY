import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, Server, Wifi, Globe2, Boxes, Plus, Loader2, X, UserPlus, Trash2, Power, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="glass-card rounded-[16px] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400">{label}</span>
        <Icon className="w-4 h-4 text-indigo-300" />
      </div>
      <div className="text-lg font-semibold mono break-all">{value}</div>
    </div>
  );
}

function GenerateIPv6Modal({ open, onClose, serverId, onDone }) {
  const [count, setCount] = useState(100);
  const [portStart, setPortStart] = useState(30000);
  const [subnet, setSubnet] = useState("");
  const [protocol] = useState("http");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [tag, setTag] = useState("ipv6");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/servers/${serverId}/generate-ipv6`, {
        count: Number(count), port_start: Number(portStart),
        subnet: subnet || null, protocol,
        auth_user: authUser || null, auth_pass: authPass || null,
        tag: tag || null,
      });
      toast.success(`Generated ${data.inserted} proxies`, {
        description: `User: ${data.auth_user}  Pass: ${data.auth_pass}`,
        duration: 10000,
      });
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/80 backdrop-blur-[12px] p-4">
      <div className="glass-card rounded-[24px] w-full max-w-lg p-7 relative" data-testid="generate-ipv6-modal">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-semibold mb-1">Generate IPv6 proxies</h2>
        <p className="text-xs text-zinc-500 mb-5">Adds virtual IPv6 addresses to the interface and binds Squid to each.</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">Count</label>
            <input type="number" min={1} max={5000} value={count} onChange={(e) => setCount(e.target.value)} className="glass-input px-3 py-2.5 text-sm" data-testid="gen-count" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">Starting port</label>
            <input type="number" value={portStart} onChange={(e) => setPortStart(e.target.value)} className="glass-input px-3 py-2.5 text-sm" data-testid="gen-port-start" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">IPv6 subnet (optional, defaults to detected /64)</label>
            <input value={subnet} onChange={(e) => setSubnet(e.target.value)} placeholder="2a0a:1234:5678::/64" className="glass-input px-3 py-2.5 text-sm mono" data-testid="gen-subnet" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">Auth user (optional)</label>
            <input value={authUser} onChange={(e) => setAuthUser(e.target.value)} placeholder="auto-generated" className="glass-input px-3 py-2.5 text-sm" data-testid="gen-user" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">Auth pass (optional)</label>
            <input value={authPass} onChange={(e) => setAuthPass(e.target.value)} placeholder="auto-generated" className="glass-input px-3 py-2.5 text-sm" data-testid="gen-pass" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400">Tag</label>
            <input value={tag} onChange={(e) => setTag(e.target.value)} className="glass-input px-3 py-2.5 text-sm" data-testid="gen-tag" />
          </div>
        </div>

        <button onClick={submit} disabled={busy} className="btn-gradient w-full mt-6 py-3 text-sm flex items-center justify-center gap-2" data-testid="gen-submit">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Generate
        </button>
      </div>
    </div>
  );
}

export default function ServerDetail() {
  const { id } = useParams();
  const [server, setServer] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({ username: "", password: "", proto: "http" });

  const load = async () => {
    try {
      const { data } = await api.get(`/servers/${id}`);
      setServer(data);
      // also try status
      try {
        const { data: s } = await api.get(`/servers/${id}/status`);
        setStatus(s);
      } catch { setStatus(null); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.post(`/servers/${id}/refresh`);
      toast.success("Refreshed from agent");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setRefreshing(false); }
  };

  const install = async () => {
    if (!window.confirm("Run apt-get install squid + dante-server on this server?")) return;
    setInstalling(true);
    try {
      const { data } = await api.post(`/servers/${id}/install`);
      if (data.ok) toast.success("Installed");
      else toast.error("Install failed — see agent logs");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setInstalling(false); }
  };

  const addUser = async () => {
    if (!userForm.username || !userForm.password) { toast.error("User + pass required"); return; }
    try {
      await api.post(`/servers/${id}/users`, userForm);
      toast.success(`User ${userForm.username} added`);
      setUserForm({ username: "", password: "", proto: "http" });
      setShowAddUser(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;
  }

  if (!server) return <div className="text-zinc-400">Server not found.</div>;

  const ipv4List = (server.interfaces || []).flatMap((i) => (i.ipv4 || []).map((a) => `${i.name}: ${a.address}/${a.prefixlen}`));
  const ipv6List = (server.interfaces || []).flatMap((i) => (i.ipv6 || []).map((a) => `${i.name}: ${a.address}/${a.prefixlen}`));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/servers" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white" data-testid="back-servers">
          <ArrowLeft className="w-3.5 h-3.5" /> All servers
        </Link>
      </div>

      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">VPS worker</p>
          <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">{server.name}</h1>
          <p className="text-sm text-zinc-400 mt-2 mono">{server.hostname} · {server.agent_url}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={refresh} disabled={refreshing} className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm flex items-center gap-2" data-testid="refresh-server-btn">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </button>
          <button onClick={install} disabled={installing} className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm flex items-center gap-2" data-testid="install-btn">
            {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />} Install / reinstall
          </button>
          <button onClick={() => setShowAddUser(true)} className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm flex items-center gap-2" data-testid="add-user-btn">
            <UserPlus className="w-4 h-4" /> Add user
          </button>
          <button onClick={() => setShowGen(true)} className="btn-gradient px-4 py-2.5 text-sm flex items-center gap-2" data-testid="open-gen-ipv6-btn">
            <Plus className="w-4 h-4" /> Generate IPv6 proxies
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <Stat label="Status" icon={Power} value={server.status} />
        <Stat label="Public IPv4" icon={Wifi} value={server.public_ipv4 || "—"} />
        <Stat label="IPv6 subnet" icon={Globe2} value={server.ipv6_subnet || "—"} />
        <Stat label="Squid users" icon={Boxes} value={status?.squid_users ?? "—"} />
      </section>

      {status && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`glass-card rounded-[16px] p-4 flex items-center justify-between ${status.squid_running ? "border-emerald-500/20" : ""}`}>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">Squid (HTTP :3128)</div>
              <div className="text-sm mt-1">{status.squid_running ? "running" : "stopped"}</div>
            </div>
            <CheckCircle2 className={`w-5 h-5 ${status.squid_running ? "text-emerald-400" : "text-zinc-600"}`} />
          </div>
          <div className={`glass-card rounded-[16px] p-4 flex items-center justify-between ${status.dante_running ? "border-emerald-500/20" : ""}`}>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">Dante (SOCKS :1080)</div>
              <div className="text-sm mt-1">{status.dante_running ? "running" : "stopped"}</div>
            </div>
            <CheckCircle2 className={`w-5 h-5 ${status.dante_running ? "text-emerald-400" : "text-zinc-600"}`} />
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-[20px] p-5">
          <h3 className="text-sm font-semibold mb-3">IPv4 addresses ({ipv4List.length})</h3>
          <ul className="text-xs mono text-zinc-300 space-y-1 max-h-[260px] overflow-auto">
            {ipv4List.length === 0 ? <li className="text-zinc-500">None.</li> : ipv4List.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="glass-card rounded-[20px] p-5">
          <h3 className="text-sm font-semibold mb-3">IPv6 addresses ({ipv6List.length})</h3>
          <ul className="text-xs mono text-zinc-300 space-y-1 max-h-[260px] overflow-auto">
            {ipv6List.length === 0 ? <li className="text-zinc-500">None.</li> : ipv6List.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </section>

      <GenerateIPv6Modal open={showGen} onClose={() => setShowGen(false)} serverId={id} onDone={load} />

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/80 backdrop-blur-[12px] p-4">
          <div className="glass-card rounded-[24px] w-full max-w-md p-7 relative" data-testid="add-user-modal">
            <button onClick={() => setShowAddUser(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-semibold mb-1">Add proxy user</h2>
            <p className="text-xs text-zinc-500 mb-5">Squid uses htpasswd; Dante uses system users.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-zinc-400">Username</label>
                <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} className="glass-input px-3 py-2.5 text-sm" data-testid="adduser-name" />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-zinc-400">Password</label>
                <input value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="glass-input px-3 py-2.5 text-sm" data-testid="adduser-pass" />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-zinc-400">Proto</label>
                <select value={userForm.proto} onChange={(e) => setUserForm({ ...userForm, proto: e.target.value })} className="glass-input px-3 py-2.5 text-sm" data-testid="adduser-proto">
                  <option value="http">HTTP (Squid)</option>
                  <option value="socks">SOCKS5 (Dante)</option>
                </select>
              </div>
            </div>
            <button onClick={addUser} className="btn-gradient w-full mt-6 py-3 text-sm" data-testid="adduser-submit">Add user</button>
          </div>
        </div>
      )}
    </div>
  );
}
