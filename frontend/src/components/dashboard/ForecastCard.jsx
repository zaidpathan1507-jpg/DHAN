import { ChevronDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { formatINR } from "../../lib/constants.js";
import EmptyState from "../common/EmptyState.jsx";
import { SkeletonCard } from "../common/Skeleton.jsx";

const STATUS_STYLES = {
  HEALTHY: "bg-dhan-green-light text-dhan-green-dark",
  WATCH: "bg-amber-light text-amber",
  "AT RISK": "bg-danger-light text-danger",
};

export default function ForecastCard({ data, loading }) {
  const [showHow, setShowHow] = useState(false);

  if (loading) return <SkeletonCard lines={3} />;

  if (!data || data.insufficient_history) {
    return (
      <div className="card p-5 md:p-6 h-full">
        <h3 className="text-base font-semibold text-navy">30-Day Forecast</h3>
        <EmptyState
          icon={TrendingUp}
          title="Not enough history yet."
          body={data?.message || "Add transactions for a more reliable forecast."}
        />
      </div>
    );
  }

  return (
    <div className="card p-5 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-navy">30-Day Forecast</h3>
        <Link to="/forecast" className="text-xs font-medium text-dhan-green hover:underline">
          View details
        </Link>
      </div>

      <p className="mt-3 text-xs text-navy-soft">Expected closing balance</p>
      <p className="text-[28px] font-bold text-navy tabular-nums">{formatINR(data.expected_closing_balance)}</p>
      <span className={`mt-1 inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[data.status]}`}>
        {data.status}
      </span>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-navy-soft/70">Best case</p>
          <p className="font-semibold text-dhan-green tabular-nums">{formatINR(data.best_case)}</p>
        </div>
        <div>
          <p className="text-xs text-navy-soft/70">Worst case</p>
          <p className="font-semibold text-danger tabular-nums">{formatINR(data.worst_case)}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-navy-soft/60">
        Based on your last {data.assumptions.periods_used} rolling periods.
        {data.assumptions.backtest_mape_pct !== null && ` Backtest error: ${data.assumptions.backtest_mape_pct}%.`}
      </p>

      <button
        onClick={() => setShowHow((s) => !s)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-navy-soft hover:text-navy"
      >
        How is this calculated? <ChevronDown size={13} className={`transition-transform ${showHow ? "rotate-180" : ""}`} />
      </button>
      {showHow && (
        <div className="mt-2 rounded-xl bg-surface-muted p-3 text-xs text-navy-soft space-y-1 animate-fade-up">
          <p>Method: {data.assumptions.method}</p>
          <p>Weights: {data.assumptions.weights.join(" / ")}</p>
          <p>Data used: {data.assumptions.data_used}</p>
        </div>
      )}
    </div>
  );
}
