import { useEffect, useRef, useState } from "react";
import { Wallet, Save, Loader2, AlertCircle, QrCode, Upload, X } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

const MAX_QR_BYTES = 600 * 1024; // 600 KB — plenty for a 400x400 PNG

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Could not read file"));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

function QrUploader({ label, network, value, onChange, dataTestPrefix }) {
  const inputRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast.error("Please upload an image file (PNG / JPG)");
      return;
    }
    if (file.size > MAX_QR_BYTES) {
      toast.error(`Image too large — max ${Math.round(MAX_QR_BYTES / 1024)} KB`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      toast.error(err.message || "Failed to read file");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] uppercase tracking-wider text-zinc-400 flex items-center gap-2">
        <QrCode className="w-3.5 h-3.5 text-indigo-300" /> {label} QR code
      </label>
      <div className="flex items-start gap-4">
        <div className="w-32 h-32 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt={`${network} QR`} className="w-full h-full object-contain bg-white" data-testid={`${dataTestPrefix}-preview`} />
          ) : (
            <span className="text-[10px] text-zinc-500 text-center px-2">No QR uploaded</span>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFile}
            className="hidden"
            data-testid={`${dataTestPrefix}-file-input`}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-xs"
            data-testid={`${dataTestPrefix}-upload-btn`}
          >
            <Upload className="w-3.5 h-3.5" /> {value ? "Replace image" : "Upload image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-xs text-red-300"
              data-testid={`${dataTestPrefix}-clear-btn`}
            >
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          )}
          <p className="text-[10px] text-zinc-500">PNG / JPG, ≤ 600 KB. This QR appears at user checkout.</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminWallets() {
  const [trc20, setTrc20] = useState("");
  const [bep20, setBep20] = useState("");
  const [trc20Qr, setTrc20Qr] = useState(null);
  const [bep20Qr, setBep20Qr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/settings");
      const w = data.wallets || {};
      setTrc20(w.trc20 || "");
      setBep20(w.bep20 || "");
      setTrc20Qr(w.trc20_qr || null);
      setBep20Qr(w.bep20_qr || null);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings/wallets", {
        trc20: trc20.trim() || null,
        bep20: bep20.trim() || null,
        trc20_qr: trc20Qr,
        bep20_qr: bep20Qr,
      });
      toast.success("Wallets saved");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-red-300/80">Admin</p>
        <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Wallet addresses</h1>
        <p className="text-sm text-zinc-400 mt-2">These are the USDT receive addresses (and QR codes) shown to users at checkout.</p>
      </header>

      <div className="glass-card rounded-[20px] p-6 flex flex-col gap-6" data-testid="wallet-settings-card">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Double-check these addresses. A wrong character means lost funds. Test with a small amount first.
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-red-300" /> USDT · TRC-20 (Tron network)
            </label>
            <input value={trc20} onChange={(e) => setTrc20(e.target.value)} placeholder="T…" className="glass-input px-3 py-2.5 text-sm mono" data-testid="wallet-trc20" />
          </div>
          <QrUploader
            label="TRC-20"
            network="trc20"
            value={trc20Qr}
            onChange={setTrc20Qr}
            dataTestPrefix="wallet-trc20-qr"
          />
        </div>

        <div className="h-px bg-white/5" />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-amber-300" /> USDT · BEP-20 (BNB Chain)
            </label>
            <input value={bep20} onChange={(e) => setBep20(e.target.value)} placeholder="0x…" className="glass-input px-3 py-2.5 text-sm mono" data-testid="wallet-bep20" />
          </div>
          <QrUploader
            label="BEP-20"
            network="bep20"
            value={bep20Qr}
            onChange={setBep20Qr}
            dataTestPrefix="wallet-bep20-qr"
          />
        </div>

        <button onClick={save} disabled={saving} className="btn-gradient py-3 text-sm flex items-center justify-center gap-2" data-testid="save-wallets">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save wallets
        </button>
      </div>
    </div>
  );
}
