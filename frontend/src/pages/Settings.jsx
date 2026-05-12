import { useEffect, useState } from "react";
import { Copy, Plus, Trash2, KeyRound, Eye, EyeOff, Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import api, { API, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function CodeBlock({ code, testid }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="mono text-xs bg-[#070912] border border-white/5 rounded-xl p-4 overflow-x-auto whitespace-pre" data-testid={testid}>
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          toast.success("Copied");
        }}
        className="absolute top-3 right-3 px-2 py-1 rounded-md border border-white/10 hover:bg-white/5 text-[11px] flex items-center gap-1"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
      </button>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/apikeys");
      setKeys(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newKeyName.trim()) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post("/apikeys", { name: newKeyName.trim() });
      setRevealedKey(data);
      setNewKeyName("");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoke this API key? Scripts using it will stop working.")) return;
    await api.delete(`/apikeys/${id}`);
    toast.success("Revoked");
    load();
  };

  const sampleCurl = revealedKey
    ? `curl -H "X-API-Key: ${revealedKey.key}" \\\n  "${API}/v1/active?format=json"`
    : `curl -H "X-API-Key: YOUR_API_KEY" \\\n  "${API}/v1/active?format=json"`;

  const samplePy = `import requests
r = requests.get(
    "${API}/v1/active",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"format": "json", "protocol": "http"},
).json()
print(r["count"], "active proxies")`;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">Configuration</p>
        <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Settings & API</h1>
        <p className="text-sm text-zinc-400 mt-2">Manage API keys for your automation scripts and blogging tools.</p>
      </header>

      <section className="glass-card rounded-[20px] p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Account</h2>
            <p className="text-xs text-zinc-500">Signed in as <span className="text-zinc-300">{user?.email}</span> · role {user?.role}</p>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-[20px] p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold">API Keys</h2>
            <p className="text-xs text-zinc-500">Use these to authenticate external scripts at <span className="mono text-zinc-300">/api/v1/active</span>.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. blog-bot)"
              className="glass-input px-3 py-2 text-sm w-[220px]"
              data-testid="new-apikey-name"
            />
            <button onClick={create} disabled={creating} className="btn-gradient px-4 py-2 text-sm flex items-center gap-2" data-testid="create-apikey-btn">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Generate
            </button>
          </div>
        </div>

        {revealedKey && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 flex flex-col gap-3" data-testid="revealed-key-box">
            <div className="flex items-center justify-between">
              <p className="text-xs text-indigo-200">
                <span className="font-semibold">Copy this key now</span> — you won't be able to see it again.
              </p>
              <button onClick={() => setRevealedKey(null)} className="text-indigo-300/70 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <code className="mono text-sm flex-1 bg-black/40 rounded-lg px-3 py-2 select-all break-all" data-testid="revealed-key-value">
                {showRaw ? revealedKey.key : "•".repeat(20) + revealedKey.key.slice(-6)}
              </code>
              <button onClick={() => setShowRaw((v) => !v)} className="px-2 py-2 rounded-lg border border-white/10 hover:bg-white/5">
                {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(revealedKey.key); toast.success("Key copied"); }}
                className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm flex items-center gap-2"
                data-testid="copy-revealed-key"
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm" data-testid="apikeys-table">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500 bg-white/[0.02]">
                <th className="text-left p-3 pl-5">Name</th>
                <th className="text-left p-3">Key</th>
                <th className="text-left p-3">Created</th>
                <th className="text-left p-3">Last used</th>
                <th className="text-right p-3 pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No API keys yet. Create one above.</td></tr>
              ) : keys.map((k) => (
                <tr key={k.id} className="border-t border-white/5 hover:bg-white/5" data-testid={`apikey-row-${k.id}`}>
                  <td className="p-3 pl-5 font-medium">{k.name}</td>
                  <td className="p-3 mono text-zinc-300">{k.key_preview}</td>
                  <td className="p-3 text-zinc-500 text-xs">{k.created_at ? new Date(k.created_at).toLocaleString() : "—"}</td>
                  <td className="p-3 text-zinc-500 text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</td>
                  <td className="p-3 pr-5 text-right">
                    <button onClick={() => revoke(k.id)} className="w-8 h-8 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 inline-flex items-center justify-center text-zinc-400 hover:text-red-300" data-testid={`revoke-apikey-${k.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card rounded-[20px] p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Use it from your scripts</h2>
          <p className="text-xs text-zinc-500">External automation / blogging scripts can fetch the active proxy pool with their API key.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400">cURL</span>
            <CodeBlock code={sampleCurl} testid="sample-curl" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400">Python</span>
            <CodeBlock code={samplePy} testid="sample-python" />
          </div>
        </div>
      </section>
    </div>
  );
}
