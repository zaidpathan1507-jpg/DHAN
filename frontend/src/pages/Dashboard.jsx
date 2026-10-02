import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import BriefCard from "../components/dashboard/BriefCard.jsx";
import CrunchBanner from "../components/dashboard/CrunchBanner.jsx";
import MoneyWaitingCard from "../components/dashboard/MoneyWaitingCard.jsx";
import AlertsList from "../components/dashboard/AlertsList.jsx";
import CashHero from "../components/dashboard/CashHero.jsx";
import CreditScoreCard from "../components/dashboard/CreditScoreCard.jsx";
import ForecastCard from "../components/dashboard/ForecastCard.jsx";
import SpendingBreakdown from "../components/dashboard/SpendingBreakdown.jsx";
import StatStrip from "../components/dashboard/StatStrip.jsx";
import TopVendors from "../components/dashboard/TopVendors.jsx";
import TrendChart, { PeriodToggle } from "../components/dashboard/TrendChart.jsx";
import api from "../lib/apiClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useCanEdit } from "../lib/useRole.js";
import { useI18n } from "../lib/i18n.jsx";

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "dash.greetMorning";
  if (h < 17) return "dash.greetAfternoon";
  return "dash.greetEvening";
}

// One orchestrated entrance for the page: sections rise in sequence, then everything is static.
const rise = (i) => ({ className: "animate-fade-up", style: { animationDelay: `${i * 70}ms` } });

export default function Dashboard() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const { openAdd } = useOutletContext();
  const canEdit = useCanEdit();
  const [period, setPeriod] = useState("30d");

  const get = (path) => api.get(path).then((r) => r.data);
  const overview = useQuery({ queryKey: ["dashboard-overview", period], queryFn: () => get(`/dashboard/overview?period=${period}`) });
  const cashflow = useQuery({ queryKey: ["dashboard-cashflow", period], queryFn: () => get(`/dashboard/cashflow?period=${period}`) });
  const spendingMix = useQuery({ queryKey: ["dashboard-spending-mix", period], queryFn: () => get(`/dashboard/spending-mix?period=${period}`) });
  const topVendors = useQuery({ queryKey: ["dashboard-top-vendors", period], queryFn: () => get(`/dashboard/top-vendors?period=${period}`) });
  const forecast = useQuery({ queryKey: ["forecast"], queryFn: () => get("/forecast") });
  const credit = useQuery({ queryKey: ["credit-readiness"], queryFn: () => get("/credit-readiness") });
  const insights = useQuery({ queryKey: ["insights"], queryFn: () => get("/insights") });

  return (
    <div className="space-y-5 md:space-y-6">
      <div {...rise(0)} className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink-soft">
            {t(greetingKey())}, {user?.name?.split(" ")[0]}
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink md:text-[32px] md:leading-tight">
            {user?.business?.name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {formatDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodToggle period={period} onChange={setPeriod} />
          {canEdit && <button onClick={openAdd} className="btn-primary hidden md:inline-flex">
            <Plus size={18} strokeWidth={2.5} /> {t("dash.add")}
          </button>}
        </div>
      </div>

      <div {...rise(1)} className="space-y-5 md:space-y-6">
        <CrunchBanner />
        <CashHero overview={overview.data} forecast={forecast.data} insights={insights.data} />
      </div>

      <div {...rise(2)}>
        <StatStrip overview={overview.data} />
      </div>

      <div {...rise(3)} className="grid animate-fade-up gap-5 lg:grid-cols-12 md:gap-6">
        <div className="lg:col-span-7">
          <BriefCard />
        </div>
        <div className="lg:col-span-5">
          <MoneyWaitingCard />
        </div>
      </div>

      <div {...rise(3)} className="grid animate-fade-up gap-5 lg:grid-cols-12 md:gap-6">
        <div className="lg:col-span-8">
          <TrendChart data={cashflow.data} loading={cashflow.isLoading} />
        </div>
        <div className="lg:col-span-4">
          <SpendingBreakdown data={spendingMix.data} loading={spendingMix.isLoading} />
        </div>
      </div>

      <div {...rise(4)} className="grid animate-fade-up gap-5 lg:grid-cols-12 md:gap-6">
        <div className="lg:col-span-7">
          <AlertsList data={insights.data} loading={insights.isLoading} />
        </div>
        <div className="lg:col-span-5">
          <TopVendors data={topVendors.data} loading={topVendors.isLoading} />
        </div>
      </div>

      <div {...rise(5)} className="grid animate-fade-up gap-5 lg:grid-cols-12 md:gap-6">
        <div className="lg:col-span-7">
          <ForecastCard data={forecast.data} loading={forecast.isLoading} />
        </div>
        <div className="lg:col-span-5">
          <CreditScoreCard data={credit.data} loading={credit.isLoading} />
        </div>
      </div>
    </div>
  );
}
