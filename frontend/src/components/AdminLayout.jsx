import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import { Shield, Users, Wallet, Activity, LogOut, Zap, Eye, ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const items = [
  { to: "/admin", icon: Activity, label: "Overview", end: true, testid: "admin-nav-overview" },
  { to: "/admin/users", icon: Users, label: "Users", testid: "admin-nav-users" },
  { to: "/admin/payments", icon: Wallet, label: "Payments", testid: "admin-nav-payments" },
  { to: "/admin/wallets", icon: SettingsIcon, label: "Wallets", testid: "admin-nav-wallets" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (user === null) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0b0f19]"><div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const handleLogout = async () => { await logout(); navigate("/signin"); };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <div className="ambient-glow w-[480px] h-[480px] bg-red-700/15 top-[-160px] left-[-120px]" />
      <div className="ambient-glow w-[600px] h-[600px] bg-indigo-700/20 bottom-[-200px] right-[-160px]" />
      <div className="fixed inset-0 grid-pattern pointer-events-none" />

      <aside className="glass-card sticky top-0 h-screen w-[88px] lg:w-[260px] flex flex-col gap-2 p-4 lg:p-5 rounded-none lg:rounded-r-[24px] border-y-0 border-l-0" data-testid="admin-sidebar">
        <div className="flex items-center gap-3 px-2 py-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="hidden lg:block">
            <div className="text-base font-semibold text-gradient leading-none">ProxyHub</div>
            <div className="text-[11px] text-red-300 mt-1 uppercase tracking-wider">Admin</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {items.map(({ to, icon: Icon, label, end, testid }) => (
            <NavLink key={to} to={to} end={end} data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive ? "bg-white/8 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:inline text-sm font-medium">{label}</span>
            </NavLink>
          ))}
          <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-1">
            <NavLink to="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 text-sm" data-testid="admin-view-user-panel">
              <Eye className="w-4 h-4" />
              <span className="hidden lg:inline">View user panel</span>
            </NavLink>
          </div>
        </nav>

        <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-purple-500 flex items-center justify-center text-sm font-semibold shrink-0">
              {(user.email || "?").slice(0,1).toUpperCase()}
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-sm font-medium truncate" data-testid="admin-user-email">{user.email}</div>
              <div className="text-[11px] text-red-300 uppercase tracking-wider">Administrator</div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center justify-center lg:justify-start gap-2 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-red-500/10 border border-transparent transition text-sm" data-testid="admin-logout">
            <LogOut className="w-4 h-4" /> <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </aside>

      <main className="relative flex-1 p-5 lg:p-8 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
