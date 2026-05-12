import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Network,
  Upload,
  Settings as SettingsIcon,
  LogOut,
  Zap,
  Server,
  CreditCard,
  Shield,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard" },
  { to: "/proxies", icon: Network, label: "Proxy List", testid: "nav-proxies" },
  { to: "/servers", icon: Server, label: "Servers", testid: "nav-servers" },
  { to: "/import", icon: Upload, label: "Bulk Import", testid: "nav-import" },
  { to: "/billing", icon: CreditCard, label: "Billing", testid: "nav-billing" },
  { to: "/settings", icon: SettingsIcon, label: "Settings & API", testid: "nav-settings" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/signin");
  };

  return (
    <aside
      className="glass-card sticky top-0 h-screen w-[88px] lg:w-[260px] flex flex-col gap-2 p-4 lg:p-5 rounded-none lg:rounded-r-[24px] border-y-0 border-l-0"
      data-testid="app-sidebar"
    >
      <div className="flex items-center gap-3 px-2 py-3 mb-2">
        <div className="w-10 h-10 rounded-xl btn-gradient flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="hidden lg:block">
          <div className="text-base font-semibold text-gradient leading-none">ProxyHub</div>
          <div className="text-[11px] text-zinc-500 mt-1">Proxy Control Panel</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {items.map(({ to, icon: Icon, label, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/dashboard"}
            data-testid={testid}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive
                  ? "bg-white/8 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-5 h-5 shrink-0 ${isActive ? "text-indigo-300" : ""}`}
                />
                <span className="hidden lg:inline text-sm font-medium">{label}</span>
                {isActive && (
                  <span className="hidden lg:inline ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink
            to="/admin"
            data-testid="nav-admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-red-300 hover:bg-red-500/10 border border-red-500/20 mt-2"
          >
            <Shield className="w-5 h-5 shrink-0" />
            <span className="hidden lg:inline text-sm font-medium">Admin panel</span>
          </NavLink>
        )}
      </nav>

      <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-semibold shrink-0">
            {(user?.email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden lg:block min-w-0">
            <div className="text-sm font-medium text-white truncate" data-testid="sidebar-user-email">
              {user?.email}
            </div>
            <div className="text-[11px] text-zinc-500 capitalize">{user?.role || "user"}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="sidebar-logout-btn"
          className="flex items-center justify-center lg:justify-start gap-2 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
