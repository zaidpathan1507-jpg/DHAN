import { Eye } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";

import { useI18n } from "../../lib/i18n.jsx";
import { NotificationsProvider } from "../../lib/notifications.jsx";
import { useCanEdit } from "../../lib/useRole.js";
import AddTransactionModal from "../transactions/AddTransactionModal.jsx";
import MobileNav from "./MobileNav.jsx";
import Sidebar from "./Sidebar.jsx";

export default function AppLayout() {
  const [addOpen, setAddOpen] = useState(false);
  const { t } = useI18n();
  const canEdit = useCanEdit();

  return (
    <NotificationsProvider>
      <div className="min-h-screen bg-surface">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          {t("nav.skip")}
        </a>
        <Sidebar onAdd={() => setAddOpen(true)} />
        <MobileNav onAdd={() => setAddOpen(true)} />
        <main id="main" className="md:pl-64">
          {!canEdit && (
            <p role="status" className="no-print flex items-center justify-center gap-2 bg-info-soft px-4 py-2 text-center text-sm font-bold text-info">
              <Eye size={16} /> {t("ro.banner")}
            </p>
          )}
          <div className="mx-auto max-w-7xl px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-12">
            <Outlet context={{ openAdd: () => setAddOpen(true) }} />
          </div>
        </main>
        {canEdit && <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />}
      </div>
    </NotificationsProvider>
  );
}
