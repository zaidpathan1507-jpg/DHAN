import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import AlertsList from "../components/dashboard/AlertsList.jsx";
import CreditScoreCard from "../components/dashboard/CreditScoreCard.jsx";
import ForecastCard from "../components/dashboard/ForecastCard.jsx";
import KpiCard from "../components/dashboard/KpiCard.jsx";
import SpendingBreakdown from "../components/dashboard/SpendingBreakdown.jsx";
import TopVendors from "../components/dashboard/TopVendors.jsx";
import TrendChart from "../components/dashboard/TrendChart.jsx";
import AddTransactionModal from "../components/transactions/AddTransactionModal.jsx";
import api from "../lib/apiClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("30d");
  const [addOpen, setAddOpen] = useState(false);

  const overview = useQuery({
    queryKey: ["dashboard-overview", period],
    queryFn: () => api.get(`/dashboard/overview?period=${period}`).then((r) => r.data),
  });
  const cashflow = useQuery({
    queryKey: ["dashboard-cashflow", period],
    queryFn: () => api.get(`/dashboard/cashflow?period=${period}`).then((r) => r.data),
  });
  const spendingMix = useQuery({
    queryKey: ["dashboard-spending-mix"],
    queryFn: () => api.get("/dashboard/spending-mix").then((r) => r.data),
  });
  const topVendors = useQuery({
    queryKey: ["dashboard-top-vendors"],
    queryFn: () => api.get("/dashboard/top-vendors").then((r) => r.data),
  });
  const forecast = useQuery({
    queryKey: ["forecast"],
    queryFn: () => api.get("/forecast").then((r) => r.data),
  });
  const credit = useQuery({
    queryKey: ["credit-readiness"],
    queryFn: () => api.get("/credit-readiness").then((r) => r.data),
  });
  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: () => api.get("/insights").then((r) => r.data),
  });

  const o = overview.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-navy-soft">
            {greeting()}, {user?.name?.split(" ")[0]}
          </p>
          <h1 className="text-2xl md:text-[32px] font-bold text-navy mt-0.5">{user?.business?.name}</h1>
          <p className="text-xs text-navy-soft/60 mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary hidden md:inline-flex">
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-navy-soft/70 mb-3">FINANCIAL OVERVIEW</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Income" amount={o?.income.amount} pctChange={o?.income.pct_change} sparkline={o?.income.sparkline} />
          <KpiCard
            label="Expenses"
            amount={o?.expenses.amount}
            pctChange={o?.expenses.pct_change}
            sparkline={o?.expenses.sparkline}
            tone="danger"
          />
          <KpiCard label="Net" amount={o?.net.amount} pctChange={o?.net.pct_change} sparkline={o?.net.sparkline} />
          <KpiCard
            label="Cash Balance"
            amount={o?.cash_balance.amount}
            pctChange={o?.cash_balance.pct_change}
            sparkline={o?.cash_balance.sparkline}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TrendChart data={cashflow.data} period={period} onPeriodChange={setPeriod} loading={cashflow.isLoading} />
        </div>
        <SpendingBreakdown data={spendingMix.data} loading={spendingMix.isLoading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <TopVendors data={topVendors.data} loading={topVendors.isLoading} />
        <ForecastCard data={forecast.data} loading={forecast.isLoading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <AlertsList data={insights.data} loading={insights.isLoading} />
        <CreditScoreCard data={credit.data} loading={credit.isLoading} />
      </div>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
