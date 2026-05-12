import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Zap, ShieldCheck, Globe2, Network, Activity, KeyRound, Boxes, Rocket,
  ArrowRight, Server, Layers, Terminal, Sparkles, ChevronRight, Github, Tag,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Pricing from "@/pages/Pricing";

const features = [
  { icon: Globe2, title: "IPv6 rotation engine",
    desc: "Generate 1,000+ unique proxies from a single /64. Each Squid port routes through a distinct outbound IPv6." },
  { icon: Network, title: "Dante + Squid, ready",
    desc: "One-line installer provisions SOCKS5 (Dante) and HTTP (Squid) with auth + rotation on your Ubuntu VPS." },
  { icon: Activity, title: "Live health checker",
    desc: "Every proxy is probed through itself every 10 minutes. Dead ones surface instantly in the dashboard." },
  { icon: KeyRound, title: "API-first",
    desc: "Generate API keys, fetch active proxies via /api/v1/active. Drop straight into your blogging or scraping scripts." },
  { icon: Server, title: "Multi-VPS",
    desc: "Connect unlimited VPS workers. Panel ↔ Agent over HTTPS + shared bearer token. Multi-tenant ready." },
  { icon: ShieldCheck, title: "Secure by default",
    desc: "JWT cookie auth, brute-force lockout, bcrypt hashing, self-signed TLS on every agent, zero secrets in the UI." },
];

const steps = [
  { n: "01", title: "Deploy the panel", body: "One docker compose command on any VPS. Mongo + backend + UI come up in under 60 seconds." },
  { n: "02", title: "Enroll your VPS", body: "Click Add server, paste the generated curl | sudo bash command into your Floxynet box, done in ~90s." },
  { n: "03", title: "Generate proxies", body: "Pick a count, a starting port, hit Generate. 1,000 IPv6-rotated HTTP proxies appear in your list, tagged & ready." },
];

const stats = [
  { v: "1000+", l: "Proxies per /64 subnet" },
  { v: "<10ms", l: "Panel → agent latency" },
  { v: "10 min", l: "Health-check cadence" },
  { v: "100%", l: "Self-hosted" },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If user is already logged in and lands here, send them straight to the app.
  useEffect(() => {
    if (user && typeof user === "object") {
      // small delay so the landing doesn't flash
      const id = setTimeout(() => navigate("/dashboard", { replace: true }), 50);
      return () => clearTimeout(id);
    }
  }, [user, navigate]);

  return (
    <div className="relative min-h-screen bg-[#0b0f19] text-white overflow-x-hidden">
      {/* Announcement bar */}
      <div className="relative z-20 w-full bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-blue-600/20 border-b border-white/5 text-center text-[12px] py-2 px-4">
        <Link to="/pricing" className="inline-flex items-center gap-2 hover:text-white text-zinc-200" data-testid="announcement-bar">
          <Tag className="w-3.5 h-3.5 text-emerald-300" />
          <span className="font-semibold text-emerald-300">Launch sale —</span>
          <span>50% off all plans + a $149 lifetime deal (was $499).</span>
          <span className="text-indigo-300 underline-offset-4 hover:underline">See plans →</span>
        </Link>
      </div>

      {/* ambient glows */}
      <div className="ambient-glow w-[600px] h-[600px] bg-indigo-700/30 top-[-200px] left-[-160px]" />
      <div className="ambient-glow w-[700px] h-[700px] bg-purple-700/25 top-[40%] right-[-220px]" />
      <div className="ambient-glow w-[500px] h-[500px] bg-blue-700/20 bottom-[-200px] left-[20%]" />
      <div className="fixed inset-0 grid-pattern pointer-events-none" />

      {/* Nav */}
      <header className="relative z-10 px-6 lg:px-12 py-5 flex items-center justify-between" data-testid="landing-header">
        <Link to="/" className="flex items-center gap-3" data-testid="landing-logo">
          <div className="w-9 h-9 rounded-xl btn-gradient flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-base font-semibold text-gradient">ProxyHub</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition" data-testid="nav-features">Features</a>
          <a href="#how" className="hover:text-white transition" data-testid="nav-how">How it works</a>
          <Link to="/pricing" className="hover:text-white transition flex items-center gap-1.5" data-testid="nav-pricing">
            Pricing
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider font-semibold">-50%</span>
          </Link>
          <a href="#deploy" className="hover:text-white transition" data-testid="nav-deploy">Deploy</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/signin" className="text-sm text-zinc-300 hover:text-white px-4 py-2 transition" data-testid="landing-signin-link">Sign in</Link>
          <Link to="/signin" className="btn-gradient text-sm px-4 py-2 flex items-center gap-2" data-testid="landing-cta-top">
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 lg:px-12 pt-12 lg:pt-20 pb-24 fade-in">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.18em] text-indigo-300 mb-6">
            <Sparkles className="w-3 h-3" /> v1 · IPv6 rotation engine
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">
            Spin up <span className="text-gradient">a thousand proxies</span>
            <br className="hidden md:block" /> from a single VPS.
          </h1>
          <p className="mt-7 text-base md:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            A self-hosted proxy panel that installs Dante and Squid on your Ubuntu box, rotates outbound IPv6 per
            port, and exposes a clean API for your blogging, scraping, and automation scripts.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signin" className="btn-gradient px-6 py-3 text-sm flex items-center gap-2" data-testid="landing-cta-hero">
              Open the panel <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#deploy" className="px-6 py-3 text-sm rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 flex items-center gap-2 transition" data-testid="landing-cta-deploy">
              <Terminal className="w-4 h-4" /> See deploy command
            </a>
          </div>

          {/* code preview card */}
          <div className="mt-14 max-w-3xl mx-auto glass-card rounded-[20px] p-1 text-left" data-testid="hero-code-card">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-[11px] text-zinc-500 mono">~/floxynet-vps$</span>
            </div>
            <pre className="mono text-[12px] leading-relaxed p-5 text-zinc-300 overflow-x-auto">
{`# 1) Deploy panel on any VPS
curl -fsSL https://raw.githubusercontent.com/you/proxyhub/main/deploy.sh | sudo bash

# 2) Open the panel, click "Add server", paste this on Floxynet:
curl -fsSL https://panel.example.com/api/bootstrap/<TOKEN>/install.sh | sudo bash

# 3) Click "Generate 1000 IPv6 proxies" — done.
curl -H "X-API-Key: $KEY" "https://panel.example.com/api/v1/active?format=txt"`}
            </pre>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 px-6 lg:px-12 -mt-6 pb-20">
        <div className="max-w-[1100px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
          {stats.map((s) => (
            <div key={s.l} className="glass-card rounded-[18px] p-5 text-center">
              <div className="text-3xl lg:text-4xl font-semibold text-gradient">{s.v}</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 mt-2">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 lg:px-12 py-20">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col items-center text-center mb-14">
            <span className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80 mb-3">What's inside</span>
            <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight">
              Everything you need to run a serious proxy fleet
            </h2>
            <p className="text-zinc-400 mt-4 max-w-xl">
              No SaaS lock-in. No per-proxy markup. Your VPS, your bandwidth, your rules.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-card rounded-[20px] p-6 hover:bg-white/[0.06] transition group" data-testid={`feature-${title.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="relative z-10 px-6 lg:px-12 py-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-col items-center text-center mb-14">
            <span className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80 mb-3">90-second setup</span>
            <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight">From zero to 1,000 proxies</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map(({ n, title, body }) => (
              <div key={n} className="glass-card rounded-[20px] p-6 relative overflow-hidden">
                <div className="text-[64px] font-semibold text-gradient leading-none opacity-30 absolute -top-4 -right-2 select-none">{n}</div>
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center mb-4">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — embedded compact view */}
      <section id="pricing" className="relative z-10">
        <Pricing compact />
        <div className="text-center -mt-6 mb-12">
          <Link to="/pricing" className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-white transition" data-testid="see-full-pricing">
            See full pricing & FAQ <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Deploy */}
      <section id="deploy" className="relative z-10 px-6 lg:px-12 py-20">
        <div className="max-w-[1100px] mx-auto glass-card rounded-[28px] p-8 lg:p-12 relative overflow-hidden">
          <div className="ambient-glow w-[400px] h-[400px] bg-indigo-600/20 -top-32 -right-20" />
          <div className="relative grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80">One-line deploy</span>
              <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight mt-3">
                Deploy the panel on any Linux VPS in 60 seconds.
              </h2>
              <p className="text-sm text-zinc-400 mt-4 leading-relaxed">
                Docker compose stack: Mongo, FastAPI backend, React UI. Then SSH into your Floxynet box, paste the
                bootstrap command from the Servers tab, and the agent self-installs Dante + Squid + a systemd unit.
              </p>
              <Link to="/signin" className="btn-gradient px-5 py-3 text-sm inline-flex items-center gap-2 mt-6" data-testid="landing-cta-bottom">
                Launch the panel <Rocket className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-[#070912] border border-white/5 rounded-[16px] p-5 mono text-[12px] leading-relaxed text-zinc-300 overflow-auto">
              <div className="text-zinc-500"># on the panel host</div>
              <div><span className="text-emerald-400">$</span> git clone &lt;your-repo&gt; proxyhub && cd proxyhub</div>
              <div><span className="text-emerald-400">$</span> cp .env.example .env && nano .env</div>
              <div><span className="text-emerald-400">$</span> docker compose up -d</div>
              <div className="mt-4 text-zinc-500"># on each Floxynet VPS</div>
              <div><span className="text-emerald-400">$</span> # paste the command from Panel → Servers → Add</div>
              <div><span className="text-purple-300">curl</span> -fsSL https://panel/api/bootstrap/&lt;TOKEN&gt;/install.sh | sudo bash</div>
              <div className="mt-4 text-zinc-500"># from your blogging script</div>
              <div><span className="text-purple-300">curl</span> -H <span className="text-amber-200">"X-API-Key: $KEY"</span> \</div>
              <div className="pl-6">https://panel/api/v1/active?format=txt</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-6 lg:px-12 py-10 border-t border-white/5 text-xs text-zinc-500 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg btn-gradient flex items-center justify-center">
            <Zap className="w-3 h-3" />
          </div>
          <span>ProxyHub · self-hosted proxy panel</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/signin" className="hover:text-white transition">Sign in</Link>
          <Link to="/pricing" className="hover:text-white transition">Pricing</Link>
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#deploy" className="hover:text-white transition">Deploy</a>
        </div>
      </footer>
    </div>
  );
}
