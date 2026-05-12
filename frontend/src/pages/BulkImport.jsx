import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";

const SAMPLE = `# Supported formats (one per line):
# host:port
# host:port:user:pass
# protocol://user:pass@host:port
http://user:pass@45.10.22.10:8080
198.51.100.42:3128:netuser:hunter2
socks5://198.51.100.43:1080
`;

export default function BulkImport() {
  const [text, setText] = useState("");
  const [defaultProtocol, setDefaultProtocol] = useState("http");
  const [defaultTags, setDefaultTags] = useState("");
  const [defaultCountry, setDefaultCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    toast.success(`Loaded ${file.name}`);
  };

  const submit = async () => {
    if (!text.trim()) {
      toast.error("Paste some proxies first");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/proxies/bulk-import", {
        text,
        default_protocol: defaultProtocol,
        default_tags: defaultTags ? defaultTags.split(",").map((s) => s.trim()).filter(Boolean) : [],
        default_country: defaultCountry || null,
      });
      setResult(data);
      toast.success(`Imported ${data.inserted}`, { description: `Skipped ${data.skipped}` });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">Onboarding</p>
          <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Bulk Import</h1>
          <p className="text-sm text-zinc-400 mt-2">Paste a list or upload a .txt — parser auto-detects the format.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-[20px] p-6 lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Proxy list</h2>
            <label
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs flex items-center gap-2 cursor-pointer"
              data-testid="upload-file-label"
            >
              <Upload className="w-3.5 h-3.5" /> Upload file
              <input type="file" accept=".txt,.csv,.list" onChange={handleFile} className="hidden" data-testid="upload-file-input" />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={SAMPLE}
            data-testid="bulk-text"
            className="glass-input mono text-xs leading-relaxed p-4 w-full min-h-[360px] resize-y"
            spellCheck={false}
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setText(SAMPLE)} className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm" data-testid="sample-btn">
              Load sample
            </button>
            <button onClick={submit} disabled={loading} className="btn-gradient px-5 py-2.5 text-sm flex items-center gap-2" data-testid="import-submit-btn">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Import
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="glass-card rounded-[20px] p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold">Defaults</h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-zinc-400">Default protocol</label>
              <select value={defaultProtocol} onChange={(e) => setDefaultProtocol(e.target.value)} className="glass-input px-3 py-2.5 text-sm" data-testid="default-protocol">
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks4">SOCKS4</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-zinc-400">Default tags</label>
              <input value={defaultTags} onChange={(e) => setDefaultTags(e.target.value)} placeholder="residential, premium" className="glass-input px-3 py-2.5 text-sm" data-testid="default-tags" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-zinc-400">Default country</label>
              <input value={defaultCountry} onChange={(e) => setDefaultCountry(e.target.value)} placeholder="US" className="glass-input px-3 py-2.5 text-sm" data-testid="default-country" />
            </div>
          </div>

          {result && (
            <div className="glass-card rounded-[20px] p-5 flex flex-col gap-3" data-testid="import-result">
              <h3 className="text-sm font-semibold">Result</h3>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Inserted: <span className="font-semibold">{result.inserted}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Skipped: <span className="font-semibold">{result.skipped}</span>
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-1 text-xs text-zinc-400 max-h-32 overflow-auto border-t border-white/5 pt-2">
                  {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
              <button onClick={() => navigate("/proxies")} className="btn-gradient w-full mt-2 py-2.5 text-sm" data-testid="view-list-btn">
                View proxy list
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
