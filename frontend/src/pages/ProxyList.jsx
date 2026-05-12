import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, Trash2, Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import api, { API, formatApiErrorDetail } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

const STATUS_OPTIONS = ["all", "active", "dead", "unknown", "checking"];
const PROTOCOLS = ["all", "http", "https", "socks4", "socks5"];

function AddModal({ open, onClose, onCreated }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState("http");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tags, setTags] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/proxies", {
        host: host.trim(),
        port: parseInt(port, 10),
        protocol,
        username: username || null,
        password: password || null,
        tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
        country: country || null,
      });
      toast.success("Proxy added");
      onCreated();
      onClose();
      setHost(""); setPort(""); setUsername(""); setPassword(""); setTags(""); setCountry("");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/80 backdrop-blur-[12px] p-4">
      <form
        onSubmit={submit}
        className="glass-card rounded-[24px] w-full max-w-lg p-7 relative"
        data-testid="add-proxy-modal"
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white" data-testid="close-add-modal">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold mb-1">Add proxy</h2>
        <p className="text-xs text-zinc-500 mb-5">Manually add a single proxy entry.</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider">Host</label>
            <input required value={host} onChange={(e) => setHost(e.target.value)} className="glass-input px-3 py-2.5 text-sm" placeholder="proxy.example.com" data-testid="add-host" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider">Port</label>
            <input required type="number" value={port} onChange={(e) => setPort(e.target.value)} className="glass-input px-3 py-2.5 text-sm" placeholder="8080" data-testid="add-port" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider">Protocol</label>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value)} className="glass-input px-3 py-2.5 text-sm" data-testid="add-protocol">
              {PROTOCOLS.filter((p) => p !== "all").map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="glass-input px-3 py-2.5 text-sm" placeholder="(optional)" data-testid="add-username" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input px-3 py-2.5 text-sm" placeholder="(optional)" data-testid="add-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider">Country</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} className="glass-input px-3 py-2.5 text-sm" placeholder="US" data-testid="add-country" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider">Tags (comma)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="glass-input px-3 py-2.5 text-sm" placeholder="residential, premium" data-testid="add-tags" />
          </div>
        </div>

        <button disabled={saving} type="submit" className="btn-gradient w-full mt-6 py-3 text-sm flex items-center justify-center gap-2" data-testid="add-submit">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save proxy
        </button>
      </form>
    </div>
  );
}

export default function ProxyList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [protocol, setProtocol] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [checkingId, setCheckingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/proxies", {
        params: { status, protocol, search: search || undefined },
      });
      setItems(data);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, protocol]);

  const toggleOne = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((p) => p.id)));
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} proxies?`)) return;
    try {
      const { data } = await api.post("/proxies/bulk-delete", Array.from(selected));
      toast.success(`Deleted ${data.deleted}`);
      load();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const checkOne = async (id) => {
    setCheckingId(id);
    try {
      const { data } = await api.post(`/proxies/${id}/check`);
      setItems((prev) => prev.map((p) => (p.id === id ? data : p)));
      toast.success(`Proxy ${data.status}`);
    } catch (e) {
      toast.error("Check failed");
    } finally {
      setCheckingId(null);
    }
  };

  const exportFile = async (format) => {
    const url = `${API}/proxies/export/download?format=${format}&status=${status === "all" ? "all" : status}`;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success(`Export started (${format.toUpperCase()})`);
  };

  const recheckAll = async () => {
    await api.post("/proxies/recheck-all");
    toast.info("Background recheck started");
    setTimeout(load, 4000);
  };

  const submitSearch = (e) => { e.preventDefault(); load(); };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">Inventory</p>
          <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Proxy List</h1>
          <p className="text-sm text-zinc-400 mt-2">Manage credentials, run health checks, export.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={recheckAll} className="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm flex items-center gap-2" data-testid="recheck-all-btn">
            <RefreshCw className="w-4 h-4" /> Recheck all
          </button>
          <button onClick={() => exportFile("txt")} className="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm flex items-center gap-2" data-testid="export-txt-btn">
            <Download className="w-4 h-4" /> TXT
          </button>
          <button onClick={() => exportFile("json")} className="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm flex items-center gap-2" data-testid="export-json-btn">
            <Download className="w-4 h-4" /> JSON
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-gradient px-4 py-2.5 text-sm flex items-center gap-2" data-testid="add-proxy-btn">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </header>

      <div className="glass-card rounded-[20px] p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <form onSubmit={submitSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search host, country, notes…"
            className="glass-input w-full pl-10 pr-3 py-2.5 text-sm"
            data-testid="proxy-search-input"
          />
        </form>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="glass-input px-3 py-2.5 text-sm min-w-[140px]" data-testid="proxy-status-filter">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={protocol} onChange={(e) => setProtocol(e.target.value)} className="glass-input px-3 py-2.5 text-sm min-w-[140px]" data-testid="proxy-protocol-filter">
          {PROTOCOLS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        {selected.size > 0 && (
          <button onClick={bulkDelete} className="px-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2" data-testid="bulk-delete-btn">
            <Trash2 className="w-4 h-4" /> Delete ({selected.size})
          </button>
        )}
      </div>

      <div className="glass-card rounded-[20px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="proxy-table">
            <thead className="sticky top-0 bg-[#0b0f19]/95 backdrop-blur">
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="text-left p-3 pl-5 w-10">
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} className="rounded" data-testid="select-all-checkbox" />
                </th>
                <th className="text-left p-3">Host</th>
                <th className="text-left p-3">Port</th>
                <th className="text-left p-3">Protocol</th>
                <th className="text-left p-3">Auth</th>
                <th className="text-left p-3">Country</th>
                <th className="text-left p-3">Latency</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Last check</th>
                <th className="text-right p-3 pr-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-10 text-center text-zinc-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={10} className="p-10 text-center text-zinc-500">No proxies. Add some via Bulk Import or click +Add.</td></tr>
              ) : items.map((p) => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/5 transition-colors group" data-testid={`proxy-row-${p.id}`}>
                  <td className="p-3 pl-5">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="rounded" />
                  </td>
                  <td className="p-3 font-medium mono">{p.host}</td>
                  <td className="p-3 mono text-zinc-300">{p.port}</td>
                  <td className="p-3 uppercase text-zinc-400 text-xs">{p.protocol}</td>
                  <td className="p-3 text-zinc-400 text-xs">{p.username ? "yes" : "—"}</td>
                  <td className="p-3 text-zinc-300">{p.country || "—"}</td>
                  <td className="p-3 mono">{p.latency_ms != null ? `${p.latency_ms} ms` : "—"}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-zinc-500 text-xs">{p.last_checked_at ? new Date(p.last_checked_at).toLocaleString() : "Never"}</td>
                  <td className="p-3 pr-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => checkOne(p.id)}
                        disabled={checkingId === p.id}
                        className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
                        title="Check now"
                        data-testid={`check-btn-${p.id}`}
                      >
                        {checkingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm("Delete this proxy?")) return;
                          await api.delete(`/proxies/${p.id}`);
                          toast.success("Deleted");
                          load();
                        }}
                        className="w-8 h-8 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 flex items-center justify-center text-zinc-400 hover:text-red-300"
                        title="Delete"
                        data-testid={`delete-btn-${p.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={load} />
    </div>
  );
}
