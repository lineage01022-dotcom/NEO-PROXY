import { useEffect, useState } from "react";
import { Wallet, Save, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

export default function AdminWallets() {
  const [trc20, setTrc20] = useState("");
  const [bep20, setBep20] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/settings");
      setTrc20(data.wallets?.trc20 || "");
      setBep20(data.wallets?.bep20 || "");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings/wallets", { trc20: trc20.trim() || null, bep20: bep20.trim() || null });
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
        <p className="text-sm text-zinc-400 mt-2">These are the USDT receive addresses shown to users at checkout.</p>
      </header>

      <div className="glass-card rounded-[20px] p-6 flex flex-col gap-5" data-testid="wallet-settings-card">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Double-check these addresses. A wrong character means lost funds. Test with a small amount first.
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-red-300" /> USDT · TRC-20 (Tron network)
          </label>
          <input value={trc20} onChange={(e) => setTrc20(e.target.value)} placeholder="T…" className="glass-input px-3 py-2.5 text-sm mono" data-testid="wallet-trc20" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-amber-300" /> USDT · BEP-20 (BNB Chain)
          </label>
          <input value={bep20} onChange={(e) => setBep20(e.target.value)} placeholder="0x…" className="glass-input px-3 py-2.5 text-sm mono" data-testid="wallet-bep20" />
        </div>

        <button onClick={save} disabled={saving} className="btn-gradient py-3 text-sm flex items-center justify-center gap-2" data-testid="save-wallets">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save wallets
        </button>
      </div>
    </div>
  );
}
