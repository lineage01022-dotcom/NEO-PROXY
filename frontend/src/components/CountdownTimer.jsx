import { useEffect, useState } from "react";
import { Clock, AlertCircle, Infinity as InfinityIcon } from "lucide-react";

function diff(target) {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return { expired: true, d: 0, h: 0, m: 0, s: 0 };
  return {
    expired: false,
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1000),
  };
}

function Box({ value, label }) {
  return (
    <div className="flex flex-col items-center min-w-[58px] px-2 py-2 rounded-xl bg-white/5 border border-white/10">
      <span className="text-2xl font-semibold tabular-nums leading-none">{String(value).padStart(2, "0")}</span>
      <span className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mt-1.5">{label}</span>
    </div>
  );
}

export default function CountdownTimer({ subscription }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!subscription) return null;

  if (subscription.is_lifetime) {
    return (
      <div className="glass-card rounded-[20px] p-5 flex items-center gap-4" data-testid="subscription-timer">
        <div className="w-11 h-11 rounded-xl btn-gradient flex items-center justify-center">
          <InfinityIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">{subscription.plan_name} · Lifetime</div>
          <div className="text-base font-semibold mt-1">Never expires</div>
        </div>
      </div>
    );
  }

  if (!subscription.expires_at) {
    return (
      <div className="glass-card rounded-[20px] p-5 flex items-center gap-4" data-testid="subscription-timer">
        <div className="w-11 h-11 rounded-xl bg-zinc-500/15 text-zinc-300 flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">{subscription.plan_name}</div>
          <div className="text-sm mt-1 text-zinc-400">Free tier — upgrade for more</div>
        </div>
      </div>
    );
  }

  const t = diff(subscription.expires_at);
  const expiringSoon = !t.expired && t.d < 7;
  const expired = t.expired;
  const accent = expired ? "bg-red-500/15 text-red-300" : expiringSoon ? "bg-amber-500/15 text-amber-300" : "btn-gradient";
  return (
    <div className="glass-card rounded-[20px] p-5 flex flex-col gap-4" data-testid="subscription-timer">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
            {expired ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400">Subscription · {subscription.plan_name}</div>
            <div className="text-sm mt-1 text-zinc-300">
              {expired ? "Expired — renew to continue" : "Time remaining"}
            </div>
          </div>
        </div>
        <a href="/billing" className="text-xs text-indigo-300 hover:text-white transition">Manage plan →</a>
      </div>
      {!expired && (
        <div className="flex items-center gap-2 flex-wrap" data-testid="countdown-boxes">
          <Box value={t.d} label="days" />
          <span className="text-zinc-600">:</span>
          <Box value={t.h} label="hrs" />
          <span className="text-zinc-600">:</span>
          <Box value={t.m} label="min" />
          <span className="text-zinc-600">:</span>
          <Box value={t.s} label="sec" />
        </div>
      )}
    </div>
  );
}
