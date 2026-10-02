import { AnimatePresence, motion } from "framer-motion";
import { Ellipsis, LayoutDashboard, LogOut, Plus, Receipt, WandSparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../../lib/AuthContext.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { useCanEdit } from "../../lib/useRole.js";
import LanguageToggle from "../common/LanguageToggle.jsx";
import Logo from "../common/Logo.jsx";
import { useOverlay } from "../common/useOverlay.js";
import NotificationBell from "./NotificationBell.jsx";
import { NAV_GROUPS } from "./Sidebar.jsx";

const MAIN_TABS = ["/dashboard", "/transactions", "/ask"];
const TAB_ICON = { "/dashboard": LayoutDashboard, "/transactions": Receipt, "/ask": WandSparkles };
const TAB_KEY = { "/dashboard": "nav.home", "/transactions": "nav.ledger", "/ask": "nav.ai" };

const tabClass = (isActive) =>
  `flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-bold transition-colors ${
    isActive ? "text-ink" : "text-ink-muted"
  }`;

function Tab({ to, label, icon: Icon }) {
  return (
    <NavLink to={to} className={({ isActive }) => tabClass(isActive)}>
      {({ isActive }) => (
        <>
          <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isActive ? "bg-gold-100" : ""}`}>
            <Icon size={21} strokeWidth={isActive ? 2.25 : 1.75} />
          </span>
          <span className="max-w-full truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function MoreSheet({ onClose }) {
  const { t } = useI18n();
  const { logout } = useAuth();
  const ref = useOverlay(true, onClose);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink-deep/55" onClick={onClose} />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.more")}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-surface-card px-4 pb-8 pt-4 shadow-elevated"
      >
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-lg font-extrabold text-ink">{t("nav.more")}</p>
          <button onClick={onClose} aria-label={t("nav.close")} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-surface-muted">
            <X size={20} />
          </button>
        </div>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !MAIN_TABS.includes(i.to) && i.to !== "/dashboard");
          if (!items.length) return null;
          return (
            <section key={group.key} className="mt-3">
              <h3 className="px-2 pb-1 text-xs font-bold text-ink-muted">{t(group.key)}</h3>
              <nav className="grid grid-cols-2 gap-1.5">
                {items.map(({ to, key, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex min-h-[52px] items-center gap-2.5 rounded-xl px-3 text-[15px] font-bold ${isActive ? "bg-gold-50 text-ink" : "bg-surface text-ink-soft"}`
                    }
                  >
                    <Icon size={19} strokeWidth={1.75} className="shrink-0" />
                    <span className="min-w-0 truncate">{t(key)}</span>
                  </NavLink>
                ))}
              </nav>
            </section>
          );
        })}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-surface-border px-2 pt-4">
          <LanguageToggle />
          <button onClick={logout} className="btn-secondary text-loss">
            <LogOut size={16} /> {t("nav.logout")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function MobileNav({ onAdd }) {
  const { t } = useI18n();
  const canEdit = useCanEdit();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = !MAIN_TABS.includes(pathname) && pathname !== "/";

  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-surface-border bg-surface-card/95 px-4 py-2.5 backdrop-blur md:hidden">
        <Logo size={32} />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <LanguageToggle />
        </div>
      </header>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5 items-end px-1 pt-1">
          <Tab to="/dashboard" label={t(TAB_KEY["/dashboard"])} icon={TAB_ICON["/dashboard"]} />
          <Tab to="/transactions" label={t(TAB_KEY["/transactions"])} icon={TAB_ICON["/transactions"]} />

          <div className="flex justify-center">
            {canEdit && (
              <button
                onClick={onAdd}
                aria-label={t("nav.add")}
                className="-mt-6 mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-ink shadow-elevated ring-4 ring-surface-card transition-transform active:scale-95"
              >
                <Plus size={28} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <Tab to="/ask" label={t(TAB_KEY["/ask"])} icon={TAB_ICON["/ask"]} />

          <button onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={tabClass(moreActive)}>
            <span className={`flex h-7 w-12 items-center justify-center rounded-full ${moreActive ? "bg-gold-100" : ""}`}>
              <Ellipsis size={21} strokeWidth={moreActive ? 2.25 : 1.75} />
            </span>
            {t("nav.more")}
          </button>
        </div>
      </nav>

      <AnimatePresence>{moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}</AnimatePresence>
    </>
  );
}
