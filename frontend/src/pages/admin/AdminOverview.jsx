import { useEffect, useState } from "react";
import { Users, Server, Globe2, Wallet, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import api from "@/lib/api";

function Card({ label, value, icon: Icon, sub, accent }) {
  return (
    <div className="glass-card rounded-[20px] p-5 flex flex-col gap-3" data-testid={`admin-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}><Icon className="w-4 h-4" /></div>
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function AdminOverview() {
  const [s, setS] = useState(null);
  useEffect(() => {
    const load = () => api.get("/admin/stats").then(({ data }) => setS(data));
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  if (!s) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-red-300/80">Admin</p>
        <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">System overview</h1>
        <p className="text-sm text-zinc-400 mt-2">Everything that happens on the platform, at a glance.</p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <Card label="Total users" value={s.users.total} icon={Users} sub={`${s.users.admin} admin`} accent="bg-indigo-500/15 text-indigo-300" />
        <Card label="VPS servers" value={s.infrastructure.servers} icon={Server} sub="connected agents" accent="bg-purple-500/15 text-purple-300" />
        <Card label="Total proxies" value={s.infrastructure.proxies.toLocaleString()} icon={Globe2} sub="across all servers" accent="bg-blue-500/15 text-blue-300" />
        <Card label="Revenue (USDT)" value={`$${s.billing.revenue_usdt}`} icon={TrendingUp} sub={`${s.billing.confirmed_payments} confirmed`} accent="bg-emerald-500/15 text-emerald-300" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card rounded-[20px] p-6">
          <h2 className="text-base font-semibold mb-3">Plan distribution</h2>
          <div className="flex flex-col gap-2">
            {Object.entries(s.users.plan_distribution).map(([plan, n]) => {
              const pct = Math.round((n / Math.max(1, s.users.total)) * 100);
              return (
                <div key={plan} className="flex items-center gap-3">
                  <span className="text-sm capitalize w-20 text-zinc-300">{plan}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full btn-gradient" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 tabular-nums w-14 text-right">{n} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="glass-card rounded-[20px] p-6">
          <h2 className="text-base font-semibold mb-3">Billing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">Pending</div>
              <div className="text-2xl font-semibold mt-1">{s.billing.pending_payments}</div>
              <div className="text-xs text-zinc-500 mt-1">awaiting admin review</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">Confirmed</div>
              <div className="text-2xl font-semibold mt-1">{s.billing.confirmed_payments}</div>
              <div className="text-xs text-emerald-300 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> activated</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
