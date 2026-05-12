import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreditCard, Check, Copy, ExternalLink, Loader2, RefreshCw, X, ChevronRight, Wallet, Shield } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import CountdownTimer from "@/components/CountdownTimer";

const PLAN_LABEL = { starter: "Starter", pro: "Pro", elite: "Elite", lifetime: "Lifetime" };
const CYCLE_LABEL = { monthly: "Monthly", annual: "Annual", lifetime: "One-time" };
const STATUS_COLORS = {
  awaiting_tx: "status-checking",
  submitted: "status-checking",
  verifying: "status-checking",
  confirmed: "status-active",
  rejected: "status-dead",
};

export default function Billing() {
  const [plans, setPlans] = useState([]);
  const [networks, setNetworks] = useState({});
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [{ data: pl }, { data: sub }, { data: pays }] = await Promise.all([
        api.get("/billing/plans"),
        api.get("/billing/subscription"),
        api.get("/billing/payments"),
      ]);
      setPlans(pl.plans);
      setNetworks(pl.networks);
      setSubscription(sub);
      setPayments(pays);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">Account</p>
        <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Billing & subscription</h1>
        <p className="text-sm text-zinc-400 mt-2">Pay with USDT on TRC-20 or BEP-20. Activates within minutes.</p>
      </header>

      <CountdownTimer subscription={subscription} />

      <section className="glass-card rounded-[20px] p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold">Choose a plan</h2>
            <p className="text-xs text-zinc-500">Crypto checkout — manual or auto-verified.</p>
          </div>
          <Link to="/pricing" className="text-xs text-indigo-300 hover:text-white inline-flex items-center gap-1">
            Compare features <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="billing-plans">
          {plans.map((p) => (
            <div key={p.id} className={`rounded-2xl p-4 border ${subscription?.plan === p.id ? "border-indigo-500/40 bg-indigo-500/5" : "border-white/10 bg-white/[0.02]"}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{p.name}</div>
                {subscription?.plan === p.id && (
                  <span className="text-[10px] uppercase tracking-wider text-indigo-300">Current</span>
                )}
              </div>
              <div className="mt-2 text-2xl font-semibold">${p.monthly_usd}{p.lifetime ? "" : <span className="text-xs text-zinc-500">/mo</span>}</div>
              <div className="text-xs text-zinc-500 mt-1">{p.ipv6_quota.toLocaleString()} IPv6 · {p.servers_quota >= 9999 ? "∞" : p.servers_quota} VPS</div>
              {p.id !== "starter" && (
                <button
                  onClick={() => navigate(`/checkout/${p.id}`)}
                  className="btn-gradient w-full mt-3 py-2 text-xs"
                  data-testid={`upgrade-${p.id}`}
                >
                  {p.lifetime ? "Buy lifetime" : "Upgrade"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-[20px] overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-base font-semibold">Payment history</h2>
          <button onClick={load} className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1" data-testid="refresh-payments">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <table className="w-full text-sm" data-testid="payments-table">
          <thead className="bg-white/[0.02]">
            <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="text-left p-3 pl-5">Date</th>
              <th className="text-left p-3">Plan</th>
              <th className="text-left p-3">Network</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3 pr-5">TX</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6} className="p-10 text-center text-zinc-500">No payments yet.</td></tr>
            ) : payments.map((p) => (
              <tr key={p.id} className="border-t border-white/5" data-testid={`payment-row-${p.id}`}>
                <td className="p-3 pl-5 text-xs text-zinc-400">{new Date(p.created_at).toLocaleString()}</td>
                <td className="p-3">{PLAN_LABEL[p.plan]} · {CYCLE_LABEL[p.billing_cycle] || p.billing_cycle}</td>
                <td className="p-3 uppercase text-xs text-zinc-300">{p.network}</td>
                <td className="p-3 text-right mono">${p.amount_usdt}</td>
                <td className="p-3"><span className={`status-badge ${STATUS_COLORS[p.status] || "status-unknown"}`}>{p.status.replace("_", " ")}</span></td>
                <td className="p-3 pr-5 text-right">
                  {p.explorer_url ? (
                    <a href={p.explorer_url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-white inline-flex items-center gap-1">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : p.status === "awaiting_tx" ? (
                    <button onClick={() => navigate(`/checkout/${p.plan}?resume=${p.id}`)} className="text-amber-300 hover:text-white">
                      Submit TX →
                    </button>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
