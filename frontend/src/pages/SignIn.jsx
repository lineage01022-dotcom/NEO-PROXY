import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Zap, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SignIn() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fn = mode === "signin" ? login(email, password) : register(email, password, name);
    const res = await fn;
    setLoading(false);
    if (res.ok) {
      const dest = res.user?.role === "admin" ? "/admin" : "/dashboard";
      navigate(dest);
    } else setError(res.error || "Could not authenticate.");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#0b0f19] px-4 overflow-hidden">
      <div className="ambient-glow w-[500px] h-[500px] bg-indigo-700/30 top-[-120px] left-[-80px]" />
      <div className="ambient-glow w-[600px] h-[600px] bg-purple-700/30 bottom-[-180px] right-[-120px]" />
      <div className="absolute inset-0 grid-pattern pointer-events-none" />

      <div className="relative w-full max-w-md fade-in">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white mb-6 transition" data-testid="signin-back-home">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </Link>
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl btn-gradient flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(168,85,247,0.6)]">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="text-gradient">ProxyHub</span>
          </h1>
          <p className="text-sm text-zinc-400">
            {mode === "signin" ? "Sign in to access your proxy control panel" : "Create a new account"}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="glass-card rounded-[24px] p-7 flex flex-col gap-5"
          data-testid="signin-form"
        >
          {mode === "register" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-300">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="signin-name-input"
                className="glass-input px-4 py-3 text-sm"
                placeholder="Jane Doe"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="signin-email-input"
              className="glass-input px-4 py-3 text-sm"
              placeholder="admin@proxy.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-300">Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="signin-password-input"
                className="glass-input px-4 py-3 text-sm w-full pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                data-testid="signin-toggle-password"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              data-testid="signin-error"
              className="text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="signin-submit-btn"
            className="btn-gradient w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <div className="text-center text-xs text-zinc-500">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "register" : "signin");
                setError("");
              }}
              data-testid="signin-toggle-mode"
              className="text-indigo-300 hover:text-indigo-200 font-medium"
            >
              {mode === "signin" ? "Register" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
