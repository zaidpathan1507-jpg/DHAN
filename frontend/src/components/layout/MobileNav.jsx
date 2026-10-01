import { LayoutDashboard, Plus, Receipt, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import AddTransactionModal from "../transactions/AddTransactionModal.jsx";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/credit", label: "More", icon: Wallet },
];

export default function MobileNav() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-surface-border bg-surface-card/95 backdrop-blur">
        <div className="grid grid-cols-5 items-center px-1 py-1.5">
          {NAV_ITEMS.slice(0, 2).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium ${
                  isActive ? "text-dhan-green" : "text-navy-soft/70"
                }`
              }
            >
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}

          <div className="flex items-center justify-center">
            <button
              onClick={() => setAddOpen(true)}
              aria-label="Add Transaction"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-dhan-green text-white shadow-elevated -mt-6 active:scale-95 transition-transform"
            >
              <Plus size={24} strokeWidth={2.25} />
            </button>
          </div>

          {NAV_ITEMS.slice(2).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium ${
                  isActive ? "text-dhan-green" : "text-navy-soft/70"
                }`
              }
            >
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
