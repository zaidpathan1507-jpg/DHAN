import { LogOut } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../lib/AuthContext.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import LanguageToggle from "../common/LanguageToggle.jsx";
import Logo from "../common/Logo.jsx";

// The customer's side of DHAN: one narrow, phone-first column. No business tools, just "what do I owe, and how do I pay".
export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-surface-border bg-surface-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button onClick={() => { logout(); navigate("/login"); }} aria-label={t("nav.logout")} title={`${user?.name} · ${t("nav.logout")}`} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-surface-muted">
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-6 pb-16 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
