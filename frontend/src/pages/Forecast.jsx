import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import ForecastAssumptions from "../components/forecast/ForecastAssumptions.jsx";
import ForecastChart from "../components/forecast/ForecastChart.jsx";
import api from "../lib/apiClient.js";
import { formatINR } from "../lib/constants.js";

const STATUS_STYLES = {
  HEALTHY: "bg-dhan-green-light text-dhan-green-dark",
  WATCH: "bg-amber-light text-amber",
  "AT RISK": "bg-danger-light text-danger",
};

export default function Forecast() {
  const query = useQuery({
    queryKey: ["forecast"],
    queryFn: () => api.get("/forecast").then((r) => r.data),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState onRetry={query.refetch} />;
  }

  const data = query.data;

  if (data.insufficient_history) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl md:text-[32px] font-bold text-navy mb-4">30-Day Cash Forecast</h1>
        <div className="card">
          <EmptyState icon={TrendingUp} title="Not enough history yet." body={data.message} />
        </div>
      </div>
    );
  }

  const expectedNet = data.expected_closing_balance - data.current_cash_balance;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-[32px] font-bold text-navy">30-Day Cash Forecast</h1>
        <p className="text-sm text-navy-soft mt-1">Where your balance is likely headed, and why.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-navy-soft/70">Expected closing balance</p>
              <p className="text-[32px] font-bold text-navy tabular-nums">{formatINR(data.expected_closing_balance)}</p>
            </div>
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[data.status]}`}>
              {data.status}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-navy-soft/70">Expected</p>
              <p className="font-semibold text-navy tabular-nums">{formatINR(data.expected_closing_balance)}</p>
            </div>
            <div>
              <p className="text-xs text-navy-soft/70">Best case</p>
              <p className="font-semibold text-dhan-green tabular-nums">{formatINR(data.best_case)}</p>
            </div>
            <div>
              <p className="text-xs text-navy-soft/70">Worst case</p>
              <p className="font-semibold text-danger tabular-nums">{formatINR(data.worst_case)}</p>
            </div>
          </div>

          <div className="mt-5">
            <ForecastChart history={data.history} expectedNet={expectedNet} />
          </div>
        </div>

        <ForecastAssumptions assumptions={data.assumptions} />
      </div>

      <div className="card p-5 md:p-6">
        <h3 className="text-base font-semibold text-navy">Expected Spend by Category</h3>
        <p className="text-xs text-navy-soft/60 mt-0.5">Excluding flagged one-offs</p>
        {!data.category_forecast?.length ? (
          <p className="mt-4 text-sm text-navy-soft">Not enough category history yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-surface-border">
            {data.category_forecast.map((c) => (
              <li key={c.category} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-navy-soft">{c.category}</span>
                <span className="font-semibold text-navy tabular-nums">{formatINR(c.expected_amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
