import { useEffect, useState } from "react";
import { Activity, AlertOctagon, CheckCircle2, Clock, RefreshCw, Loader2, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import CountdownTimer from "@/components/CountdownTimer";

function Kpi({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="glass-card rounded-[20px] p-5 flex flex-col gap-3" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-zinc-400">{label}</div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

const PROTO_COLORS = ["#A855F7", "#3B82F6", "#6366F1", "#10B981", "#F97316"];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [{ data: s }, sub] = await Promise.all([
        api.get("/stats/dashboard"),
        api.get("/billing/subscription").then((r) => r.data).catch(() => null),
      ]);
      setStats(s);
      setSubscription(sub);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const triggerCheck = async () => {
    try {
      setRefreshing(true);
      await api.post("/proxies/recheck-all");
      toast.success("Health check started", { description: "Refreshing in a few seconds…" });
      setTimeout(load, 4000);
    } catch (e) {
      toast.error("Could not start check");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  const protoData = Object.entries(stats?.by_protocol || {}).map(([k, v], i) => ({
    name: k,
    value: v,
    fill: PROTO_COLORS[i % PROTO_COLORS.length],
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">Overview</p>
          <h1 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">Proxy Health Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Real-time view of your proxy fleet. Background health checks run every 10 minutes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/import"
            data-testid="dashboard-import-link"
            className="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm flex items-center gap-2 transition-all"
          >
            <ArrowUpRight className="w-4 h-4" /> Import proxies
          </Link>
          <button
            onClick={triggerCheck}
            disabled={refreshing}
            data-testid="dashboard-recheck-btn"
            className="btn-gradient px-4 py-2.5 text-sm flex items-center gap-2"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recheck all
          </button>
        </div>
      </header>

      <CountdownTimer subscription={subscription} />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-5 stagger">
        <Kpi
          label="Total proxies"
          value={stats?.total ?? 0}
          sub="Across all protocols"
          icon={Activity}
          accent="bg-indigo-500/15 text-indigo-300"
        />
        <Kpi
          label="Active"
          value={stats?.active ?? 0}
          sub={`${stats?.healthy_percent ?? 0}% healthy`}
          icon={CheckCircle2}
          accent="bg-emerald-500/15 text-emerald-300"
        />
        <Kpi
          label="Dead"
          value={stats?.dead ?? 0}
          sub="Marked unreachable"
          icon={AlertOctagon}
          accent="bg-red-500/15 text-red-300"
        />
        <Kpi
          label="Avg latency"
          value={`${stats?.avg_latency_ms ?? 0} ms`}
          sub={`min ${stats?.min_latency_ms ?? 0} • max ${stats?.max_latency_ms ?? 0}`}
          icon={Clock}
          accent="bg-purple-500/15 text-purple-300"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-card rounded-[20px] p-6 lg:col-span-2" data-testid="latency-distribution-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Latency distribution</h2>
              <p className="text-xs text-zinc-500">Among active proxies (ms)</p>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.latency_distribution || []}>
                <defs>
                  <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={1} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(11,15,25,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="count" fill="url(#latGrad)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-[20px] p-6" data-testid="protocol-mix-card">
          <h2 className="text-base font-semibold">Protocol mix</h2>
          <p className="text-xs text-zinc-500">Distribution by type</p>
          <div className="h-[260px]">
            {protoData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-zinc-500">No proxies yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={protoData} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                    {protoData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(11,15,25,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
