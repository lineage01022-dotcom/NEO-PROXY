import { useEffect, useState } from "react";
import { Loader2, ExternalLink, CheckCircle2, XCircle, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

const STATUS_COLORS = {
  awaiting_tx: "status-checking",
  submitted: "status-checking",
  verifying: "status-checking",
  confirmed: "status-active",
  rejected: "status-dead",
};

export default function AdminPayments() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("submitted");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/payments", { params: { status: filter } });
      setItems(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const approve = async (id) => {
    setActingId(id);
    try { await api.post(`/admin/payments/${id}/approve`); toast.success("Approved & activated"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setActingId(null); }
  };
  const reject = async (id) => {
    const reason = window.prompt("Reason for rejection?", "Could not verify");
    if (reason === null) return;
    setActingId(id);
    try { await api.post(`/admin/payments/${id}/reject`, null, { params: { reason } }); toast.success("Rejected"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setActingId(null); }
  };
  const autoVerify = async (id) => {
    setActingId(id);
    try {
      const { data } = await api.post(`/admin/payments/${id}/auto-verify`);
      if (data.ok) { toast.success(`Verified: ${data.amount} USDT`); load(); }
      else toast.message("Not verified", { description: data.error });
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setActingId(null); }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-red-300/80">Admin</p>
          <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Payments</h1>
          <p className="text-sm text-zinc-400 mt-2">Review submitted TX hashes, approve, or auto-verify on-chain.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="glass-input px-3 py-2.5 text-sm" data-testid="payment-filter">
            <option value="submitted">Pending review</option>
            <option value="awaiting_tx">Awaiting TX</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <button onClick={load} className="px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm flex items-center gap-2" data-testid="reload-payments">
            <RefreshCw className="w-4 h-4" /> Reload
          </button>
        </div>
      </header>

      <div className="glass-card rounded-[20px] overflow-hidden">
        <table className="w-full text-sm" data-testid="admin-payments-table">
          <thead className="bg-white/[0.02]">
            <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="text-left p-3 pl-5">When</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Plan</th>
              <th className="text-left p-3">Network</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">TX</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3 pr-5">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="p-10 text-center text-zinc-500">No payments in this view.</td></tr>
            ) : items.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/5" data-testid={`admin-payment-${p.id}`}>
                <td className="p-3 pl-5 text-xs text-zinc-400">{new Date(p.created_at).toLocaleString()}</td>
                <td className="p-3 text-xs">{p.user_email}</td>
                <td className="p-3 capitalize">{p.plan} · {p.billing_cycle}</td>
                <td className="p-3 uppercase text-xs">{p.network}</td>
                <td className="p-3 text-right mono">${p.amount_usdt}</td>
                <td className="p-3 mono text-[11px]">
                  {p.tx_hash ? (
                    <a href={p.explorer_url || "#"} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-white inline-flex items-center gap-1">
                      {p.tx_hash.slice(0, 10)}…{p.tx_hash.slice(-6)} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : <span className="text-zinc-500">—</span>}
                </td>
                <td className="p-3"><span className={`status-badge ${STATUS_COLORS[p.status] || "status-unknown"}`}>{p.status.replace("_", " ")}</span></td>
                <td className="p-3 pr-5 text-right">
                  {p.status === "submitted" && (
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => autoVerify(p.id)} disabled={actingId === p.id} className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs inline-flex items-center gap-1" data-testid={`auto-verify-${p.id}`}>
                        {actingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />} Verify
                      </button>
                      <button onClick={() => approve(p.id)} disabled={actingId === p.id} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs inline-flex items-center gap-1" data-testid={`approve-${p.id}`}>
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => reject(p.id)} disabled={actingId === p.id} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 text-xs inline-flex items-center gap-1" data-testid={`reject-${p.id}`}>
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
