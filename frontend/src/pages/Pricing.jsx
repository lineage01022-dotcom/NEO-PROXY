import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Check, ArrowRight, Zap, Sparkles, Crown, Rocket, ShieldCheck, ChevronRight,
  Star, Globe2, Wifi, Activity, LifeBuoy, KeyRound, Boxes, Infinity as InfinityIcon, Gift,
} from "lucide-react";
import NeoLogo from "@/components/NeoLogo";

// ---------------------------------------------------------------------------
// Tiers — values 1:1 with the spec the user supplied
// ---------------------------------------------------------------------------
const tiers = [
  {
    id: "free",
    name: "Free",
    icon: Gift,
    tagline: "Kick the tires",
    monthly: 0,
    cta: "Start free",
    badge: null,
    highlight: false,
    features: [
      { icon: Globe2,   label: "IPv6 Proxies",    value: "10" },
      { icon: Wifi,     label: "Dedicated IPv4",  value: "—",            muted: true },
      { icon: Boxes,    label: "Bandwidth",       value: "5 GB" },
      { icon: Activity, label: "Health check",    value: "Every 60 min" },
      { icon: LifeBuoy, label: "Support",         value: "Community" },
      { icon: KeyRound, label: "API access",      value: "Basic" },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    icon: Rocket,
    tagline: "Test the waters",
    monthly: 9.99,
    cta: "Start with Starter",
    badge: null,
    highlight: false,
    features: [
      { icon: Globe2,   label: "IPv6 Proxies",    value: "100" },
      { icon: Wifi,     label: "Dedicated IPv4",  value: "—",            muted: true },
      { icon: Boxes,    label: "Bandwidth",       value: "50 GB" },
      { icon: Activity, label: "Health check",    value: "Every 30 min" },
      { icon: LifeBuoy, label: "Support",         value: "Email" },
      { icon: KeyRound, label: "API access",      value: "Basic" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    icon: Sparkles,
    tagline: "Solo operators & bloggers",
    monthly: 19.99,
    cta: "Start Pro — 50% off",
    badge: "Most popular",
    highlight: true,
    features: [
      { icon: Globe2,   label: "IPv6 Proxies",    value: "1,000" },
      { icon: Wifi,     label: "Dedicated IPv4",  value: "1 Shared IP" },
      { icon: Boxes,    label: "Bandwidth",       value: "500 GB" },
      { icon: Activity, label: "Health check",    value: "Every 5 min" },
      { icon: LifeBuoy, label: "Support",         value: "Priority" },
      { icon: KeyRound, label: "API access",      value: "Full Access" },
    ],
  },
  {
    id: "elite",
    name: "Elite",
    icon: Crown,
    tagline: "Agencies & power users",
    monthly: 49.99,
    cta: "Go Elite",
    badge: "Best value",
    highlight: false,
    features: [
      { icon: Globe2,   label: "IPv6 Proxies",    value: "5,000" },
      { icon: Wifi,     label: "Dedicated IPv4",  value: "1 Dedicated IP" },
      { icon: Boxes,    label: "Bandwidth",       value: "Unlimited*",  highlightValue: true },
      { icon: Activity, label: "Health check",    value: "Every 1 min" },
      { icon: LifeBuoy, label: "Support",         value: "24/7 Personal" },
      { icon: KeyRound, label: "API access",      value: "Full Access + SDK" },
    ],
  },
];

// Annual = 2 months free (≈17% off). Display & math both react to this.
const ANNUAL_DISCOUNT = 10 / 12;

const competitors = [
  { name: "Bright Data — residential",   price: "$500+",  per: "/ 50 GB",   note: "metered, pay per GB" },
  { name: "Oxylabs — residential",       price: "$450",   per: "/ 50 GB",   note: "metered, contract" },
  { name: "Smartproxy — datacenter",     price: "$80",    per: "/ month",   note: "100 proxies, no IPv6 rotation" },
  { name: "IPRoyal — IPv6",              price: "$1,200", per: "/ month",   note: "$1.20 / proxy × 1,000" },
  { name: "NEO PROXY · Pro (you)",       price: "$19.99", per: "/ month",   note: "1,000 IPv6 proxies on your VPS", us: true },
];

const faqs = [
  {
    q: "Why so much cheaper than Bright Data / Oxylabs?",
    a: "Because you bring the VPS. We're not reselling bandwidth — you keep 100% of it. A Floxynet box with a /64 costs ~€5/mo and produces unlimited proxies.",
  },
  { q: "Is this really self-hosted?",
    a: "Yes. The Docker stack runs on your machine, your data never leaves it. Your VPS holds the agent token; the panel only knows where to connect." },
  { q: "Can I cancel anytime?",
    a: "Yes. Monthly plans are cancel-anytime, no questions asked." },
  { q: "What's the launch discount?",
    a: "Until launch ends, every tier is 50% off the listed retail price. Annual billing adds another 2 free months on top." },
  { q: "Do you take crypto?",
    a: "Yes — BTC, ETH, USDT (TRC-20). Email billing@proxyhub.dev after registering and we'll send a payment link." },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
function BillingToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-full p-1 text-xs" data-testid="billing-toggle">
      {["monthly", "annual"].map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          data-testid={`billing-${m}`}
          className={[
            "px-4 py-2 rounded-full transition-all duration-200 capitalize flex items-center gap-2",
            value === m ? "btn-gradient text-white" : "text-zinc-400 hover:text-white",
          ].join(" ")}
        >
          {m}
          {m === "annual" && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${value === "annual" ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"}`}>
              2 mo free
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function PriceCard({ tier, billing }) {
  const Icon = tier.icon;
  const isFree = tier.monthly === 0;
  const monthly = tier.monthly;
  const effective = billing === "annual" && !isFree ? +(monthly * ANNUAL_DISCOUNT).toFixed(2) : monthly;
  const annualTotal = +(effective * 12).toFixed(2);
  const original = +(monthly * 2).toFixed(2); // Launch sale = 50% off retail
  const discount = isFree ? 0 : Math.round(((original - monthly) / original) * 100);

  return (
    <div
      className={[
        "relative flex flex-col rounded-[24px] p-7 transition-all duration-300 will-change-transform",
        tier.highlight
          ? "glass-card border-indigo-500/30 shadow-[0_30px_60px_-20px_rgba(99,102,241,0.45),0_0_0_1px_rgba(168,85,247,0.25)] lg:scale-[1.04] hover:lg:scale-[1.06]"
          : "glass-card hover:border-white/20 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]",
      ].join(" ")}
      data-testid={`tier-${tier.id}`}
    >
      {tier.badge && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 btn-gradient text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full whitespace-nowrap font-semibold"
          data-testid={`tier-${tier.id}-badge`}
        >
          {tier.badge}
        </span>
      )}

      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition ${tier.highlight ? "btn-gradient" : "bg-white/5"}`}>
          <Icon className={`w-5 h-5 ${tier.highlight ? "text-white" : "text-indigo-300"}`} />
        </div>
        <div>
          <div className="text-xl font-semibold leading-none">{tier.name}</div>
          <div className="text-[11px] text-zinc-500 mt-1.5">{tier.tagline}</div>
        </div>
      </div>

      {/* Price block */}
      <div className="mt-7">
        <div className="flex items-end gap-1">
          {!isFree && <span className="text-lg text-zinc-400 mb-3">$</span>}
          <span
            key={`${tier.id}-${billing}`}
            className="text-[56px] font-semibold tracking-tight leading-none tabular-nums animate-[fadeIn_0.3s_ease]"
            data-testid={`tier-${tier.id}-price`}
          >
            {isFree ? (
              "$0"
            ) : (
              <>
                {Math.floor(effective)}
                <span className="text-3xl align-top">
                  .{(effective % 1).toFixed(2).slice(2)}
                </span>
              </>
            )}
          </span>
          <span className="text-sm text-zinc-400 ml-2 mb-3">/mo</span>
        </div>

        {!isFree && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-500 line-through tabular-nums">${original.toFixed(2)}/mo</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider font-semibold">
              {discount}% OFF · Launch
            </span>
          </div>
        )}
        {isFree && (
          <div className="mt-3 text-[11px] text-zinc-500">No credit card required</div>
        )}
        {billing === "annual" && !isFree && (
          <div className="mt-2 text-[11px] text-zinc-500">
            Billed annually at <span className="text-zinc-300 tabular-nums">${annualTotal.toFixed(2)}</span> · save{" "}
            <span className="text-emerald-300 font-semibold">${((monthly - effective) * 12).toFixed(2)}/yr</span>
          </div>
        )}
      </div>

      <Link
        to="/signin"
        data-testid={`tier-${tier.id}-cta`}
        className={[
          "mt-7 py-3 px-4 text-sm rounded-xl flex items-center justify-center gap-2 transition-all duration-200 font-semibold",
          tier.highlight
            ? "btn-gradient"
            : "border border-white/10 hover:border-white/30 hover:bg-white/5",
        ].join(" ")}
      >
        {tier.cta} <ArrowRight className="w-4 h-4" />
      </Link>

      {/* Feature matrix — clean key/value layout */}
      <ul className="mt-7 space-y-1.5 flex-1">
        {tier.features.map((f, i) => {
          const FIcon = f.icon;
          return (
            <li
              key={i}
              className="flex items-center justify-between gap-3 text-sm py-2.5 border-b border-white/[0.04] last:border-b-0 group/row"
            >
              <span className="flex items-center gap-2.5 text-zinc-400">
                <FIcon className="w-4 h-4 text-zinc-500 group-hover/row:text-indigo-300 transition-colors" />
                {f.label}
              </span>
              <span
                className={[
                  "text-right font-medium tabular-nums",
                  f.muted ? "text-zinc-600" : "text-white",
                  f.highlightValue ? "text-gradient font-semibold" : "",
                ].join(" ")}
              >
                {f.value}
              </span>
            </li>
          );
        })}
      </ul>

      {tier.id === "elite" && (
        <div className="mt-4 text-[10px] text-zinc-500 italic">
          *Fair-use cap: 5 TB / month. Hit it and we'll just email you.
        </div>
      )}
    </div>
  );
}

export default function Pricing({ compact = false }) {
  const [billing, setBilling] = useState("monthly");

  return (
    <div className={compact ? "" : "relative min-h-screen bg-[#0b0f19] text-white overflow-x-hidden"}>
      {!compact && (
        <>
          <div className="ambient-glow w-[600px] h-[600px] bg-indigo-700/25 top-[-200px] left-[-160px]" />
          <div className="ambient-glow w-[700px] h-[700px] bg-purple-700/20 top-[20%] right-[-220px]" />
          <div className="fixed inset-0 grid-pattern pointer-events-none" />

          <header className="relative z-10 px-6 lg:px-12 py-5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <NeoLogo size={36} />
              <span className="text-base neo-wordmark text-neon">NEO PROXY</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
              <Link to="/" className="hover:text-white transition">Home</Link>
              <Link to="/pricing" className="text-white">Pricing</Link>
              <Link to="/signin" className="hover:text-white transition">Sign in</Link>
            </nav>
            <Link to="/signin" className="btn-gradient text-sm px-4 py-2 flex items-center gap-2">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </header>
        </>
      )}

      {/* Hero + tiers */}
      <section className={`relative z-10 px-6 lg:px-12 ${compact ? "py-16" : "pt-12 pb-20"}`}>
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] uppercase tracking-[0.18em] text-emerald-300 mb-5" data-testid="launch-chip">
              <Star className="w-3 h-3 fill-current" /> Launch sale · 50% off for 30 days
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight">
              Pricing that <span className="text-gradient">undercuts every competitor</span>
            </h1>
            <p className="text-zinc-400 mt-5 max-w-2xl">
              You bring the VPS. We give you the software. The same proxy fleet you'd pay $500+/month
              for at Bright Data — for the price of a coffee.
            </p>

            <div className="mt-7">
              <BillingToggle value={billing} onChange={setBilling} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger pt-3">
            {tiers.map((t) => <PriceCard key={t.id} tier={t} billing={billing} />)}
          </div>

          {/* Lifetime banner */}
          <div className="mt-12 glass-card rounded-[24px] p-6 lg:p-7 flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-8 relative overflow-hidden" data-testid="lifetime-banner">
            <div className="ambient-glow w-[300px] h-[300px] bg-purple-600/20 -top-32 -right-20" />
            <div className="flex items-center gap-4 relative">
              <div className="w-12 h-12 rounded-2xl btn-gradient flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-semibold">Lifetime deal</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider font-semibold">
                    Only 100 spots
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mt-1">
                  Everything in <span className="text-zinc-200">Elite</span>, paid once. All future updates included.
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-5 relative">
              <div>
                <div className="text-3xl font-semibold tracking-tight">$149</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500 line-through tabular-nums">$499</span>
                  <span className="text-emerald-300 font-semibold">SAVE 70%</span>
                </div>
              </div>
              <Link to="/signin" className="btn-gradient px-5 py-3 text-sm flex items-center gap-2" data-testid="lifetime-cta">
                Claim lifetime <Rocket className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Competitor table */}
      <section className="relative z-10 px-6 lg:px-12 py-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-col items-center text-center mb-10">
            <span className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80 mb-3">Apples-to-apples</span>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight">How we compare</h2>
            <p className="text-sm text-zinc-400 mt-3 max-w-lg">
              Cost to run <span className="text-zinc-200">1,000 IPv6 proxies for a month</span>:
            </p>
          </div>

          <div className="glass-card rounded-[20px] overflow-hidden" data-testid="competitor-table">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="text-left p-4 pl-6">Provider</th>
                  <th className="text-right p-4">Cost / month</th>
                  <th className="text-left p-4 pl-6">Notes</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c, i) => (
                  <tr key={i} className={`border-t border-white/5 ${c.us ? "bg-indigo-500/5" : "hover:bg-white/[0.02]"} transition-colors`}>
                    <td className="p-4 pl-6 font-medium">
                      <div className="flex items-center gap-2">
                        {c.us && <Zap className="w-4 h-4 text-indigo-300" />}
                        <span className={c.us ? "text-white" : "text-zinc-200"}>{c.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className={c.us ? "text-2xl font-semibold text-gradient" : "text-zinc-300 mono"}>{c.price}</span>
                      <span className="text-xs text-zinc-500 ml-1">{c.per}</span>
                    </td>
                    <td className="p-4 pl-6 text-xs text-zinc-500">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ~<span className="text-zinc-300">96% cheaper</span> than the median residential provider. Yes, really.
          </div>
        </div>
      </section>

      {!compact && (
        <>
          {/* FAQ */}
          <section className="relative z-10 px-6 lg:px-12 py-20">
            <div className="max-w-[900px] mx-auto">
              <div className="text-center mb-12">
                <span className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80">Questions</span>
                <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight mt-3">Frequently asked</h2>
              </div>
              <div className="space-y-3">
                {faqs.map((f, i) => (
                  <details key={i} className="glass-card rounded-[16px] p-5 group transition-all hover:border-white/15" data-testid={`faq-${i}`}>
                    <summary className="cursor-pointer flex items-center justify-between gap-3 list-none">
                      <span className="text-sm font-medium">{f.q}</span>
                      <ChevronRight className="w-4 h-4 text-zinc-400 group-open:rotate-90 transition-transform" />
                    </summary>
                    <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="relative z-10 px-6 lg:px-12 pb-24">
            <div className="max-w-[1000px] mx-auto glass-card rounded-[28px] p-8 lg:p-12 text-center relative overflow-hidden">
              <div className="ambient-glow w-[400px] h-[400px] bg-indigo-600/25 -top-32 -left-20" />
              <div className="ambient-glow w-[400px] h-[400px] bg-purple-600/25 -bottom-32 -right-20" />
              <div className="relative">
                <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight">Stop renting proxies. Start owning them.</h2>
                <p className="text-zinc-400 mt-4 max-w-2xl mx-auto">
                  Launch deal ends in 30 days. Grab the lifetime plan or pick a tier and upgrade later — your VPS, your bandwidth, your rules.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link to="/signin" className="btn-gradient px-6 py-3 text-sm flex items-center gap-2" data-testid="pricing-final-cta">
                    Start now <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/" className="px-6 py-3 text-sm rounded-xl border border-white/10 hover:bg-white/5">
                    Back to home
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
