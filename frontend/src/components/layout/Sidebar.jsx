import {
  Bot,
  CalendarRange,
  FileText,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  Receipt,
  ReceiptText,
  Settings as SettingsIcon,
  Sparkles,
  TrendingUp,
  Wallet,
  WandSparkles,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../../lib/AuthContext.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { useCanEdit } from "../../lib/useRole.js";
import LanguageToggle from "../common/LanguageToggle.jsx";
import Logo from "../common/Logo.jsx";
import NotificationBell from "./NotificationBell.jsx";

// Navigation, grouped so thirteen destinations still scan at a glance. Also feeds the mobile "More" sheet.
export const NAV_GROUPS = [
  {
    key: "nav.g.money",
    items: [
      { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
      { to: "/transactions", key: "nav.transactions", icon: Receipt },
      { to: "/receivables", key: "nav.receivables", icon: HandCoins },
      { to: "/cash-calendar", key: "nav.cashCalendar", icon: CalendarRange },
    ],
  },
  {
    key: "nav.g.intel",
    items: [
      { to: "/ask", key: "nav.ai", icon: WandSparkles },
      { to: "/insights", key: "nav.insights", icon: Sparkles },
      { to: "/forecast", key: "nav.forecast", icon: TrendingUp },
      { to: "/reports", key: "nav.reports", icon: FileText },
    ],
  },
  {
    key: "nav.g.grow",
    items: [
      { to: "/loans", key: "nav.loans", icon: Landmark },
      { to: "/credit", key: "nav.credit", icon: Wallet },
      { to: "/gst", key: "nav.gst", icon: ReceiptText },
    ],
  },
  {
    key: "nav.g.tools",
    items: [
      { to: "/bot", key: "nav.bot", icon: MessageCircle },
      { to: "/settings", key: "nav.settings", icon: SettingsIcon },
    ],
  },
];
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function Sidebar({ onAdd }) {
  const { user, logout } = useAuth();
  const { t, tr } = useI18n();
  const canEdit = useCanEdit();

  return (
    <aside className="hidden border-r border-surface-border bg-surface-card md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
      <div className="flex items-center justify-between px-6 pb-4 pr-4 pt-6">
        <Logo />
        <NotificationBell />
      </div>

      <div className="mx-4 rounded-xl bg-surface px-4 py-2.5">
        <p className="truncate text-sm font-extrabold text-ink">{user?.business?.name}</p>
        <p className="truncate text-xs text-ink-muted">
          {tr("biz", user?.business?.business_type)} · {user?.business?.city}
        </p>
      </div>

      <div className="px-4 pt-3">
        {canEdit ? (
          <button onClick={onAdd} className="btn-primary w-full">
            <Plus size={18} strokeWidth={2.5} /> {t("nav.add")}
          </button>
        ) : (
          <p className="rounded-xl bg-info-soft px-3 py-2.5 text-center text-sm font-bold text-info">{t("ro.badge")}</p>
        )}
      </div>

      <nav aria-label="Main" className="mt-2 flex-1 overflow-y-auto px-3 pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="mt-3">
            <p className="px-3 pb-1 text-xs font-bold text-ink-muted">{t(group.key)}</p>
            <div className="space-y-0.5">
              {group.items.map(({ to, key, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex min-h-[40px] items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                      isActive ? "bg-gold-50 font-extrabold text-ink" : "font-semibold text-ink-soft hover:bg-surface hover:text-ink"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className={isActive ? "text-gold-700" : ""} />
                      {t(key)}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-surface-border px-4 py-3">
        <LanguageToggle />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-gold-400">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
            <p className="num truncate text-xs text-ink-muted">{user?.phone}</p>
          </div>
          <button
            onClick={logout}
            aria-label={t("nav.logout")}
            title={t("nav.logout")}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-loss-soft hover:text-loss"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
