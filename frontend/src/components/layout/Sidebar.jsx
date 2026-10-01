import { LayoutDashboard, LogOut, Receipt, Settings as SettingsIcon, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../../lib/AuthContext.jsx";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/insights", label: "Insights & Alerts", icon: Sparkles },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/credit", label: "Credit Readiness", icon: Wallet },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-surface-border bg-surface-card">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dhan-green text-white font-bold text-sm">
          D
        </div>
        <span className="text-lg font-bold tracking-tight text-navy">DHAN</span>
      </div>

      <div className="px-6 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-navy-soft/70">Business</p>
        <p className="mt-1 truncate text-sm font-semibold text-navy">{user?.business?.name}</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dhan-green-light text-dhan-green-dark"
                  : "text-navy-soft hover:bg-surface-muted hover:text-navy"
              }`
            }
          >
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-white text-sm font-semibold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy">{user?.name}</p>
            <p className="truncate text-xs text-navy-soft/70">{user?.phone}</p>
          </div>
          <button
            onClick={logout}
            aria-label="Logout"
            className="rounded-lg p-1.5 text-navy-soft hover:bg-surface-muted hover:text-danger transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
