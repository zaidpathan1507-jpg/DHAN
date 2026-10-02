import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Siren } from "lucide-react";
import { Link } from "react-router-dom";

import api from "../../lib/apiClient.js";
import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

// Only renders when the Cash Calendar predicts the balance dipping below the safety buffer.
export default function CrunchBanner() {
  const { t, formatDate } = useI18n();
  const query = useQuery({ queryKey: ["cash-calendar", { sales: 0, costs: 0 }], queryFn: () => api.get("/cash-calendar", { params: { days: 45 } }).then((r) => r.data), staleTime: 60000 });
  const c = query.data;
  if (!c || c.insufficient_history || !c.crunch) return null;

  const critical = c.crunch.level === "critical";
  const Icon = critical ? Siren : AlertTriangle;
  const date = formatDate(c.crunch.date, { day: "numeric", month: "short" });
  return (
    <Link to="/cash-calendar" className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-5 py-4 shadow-card ${critical ? "bg-loss text-white" : "bg-gold-500 text-ink"}`}>
      <Icon size={24} className="shrink-0" />
      <span className="min-w-0 flex-1 text-[15px] font-extrabold">
        {t(critical ? "cc.bannerCrit" : "cc.bannerWarn", { date })}
        <span className="num ml-2 font-semibold opacity-90">{t("cc.shortBy", { amount: formatINR(c.crunch.shortfall) })}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-extrabold underline decoration-2 underline-offset-4">{t("cc.bannerCta")} <ArrowRight size={16} /></span>
    </Link>
  );
}
