import { ChevronDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Skeleton from "../common/Skeleton.jsx";
import RangeBar from "../forecast/RangeBar.jsx";

export const STATUS_STYLES = {
  HEALTHY: "bg-gain-soft text-gain-ink",
  WATCH: "bg-gold-100 text-gold-700",
  "AT RISK": "bg-loss-soft text-loss",
};

export default function ForecastCard({ data, loading }) {
  const [showHow, setShowHow] = useState(false);
  const { t } = useI18n();

  if (loading) return <Skeleton className="h-72 w-full rounded-2xl" />;

  if (!data || data.insufficient_history) {
    return (
      <div className="card h-full p-5 md:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t("dash.forecast")}</h2>
        <EmptyState icon={TrendingUp} title={t("dash.noHistory")} body={data?.message || t("dash.noHistoryBody")} />
      </div>
    );
  }

  return (
    <div className="card flex h-full flex-col p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">{t("dash.forecast")}</h2>
        <Link to="/forecast" className="link text-sm">
          {t("common.viewDetails")}
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-muted">{t("dash.expectedClose")}</p>
          <p className="num text-[30px] font-extrabold leading-tight text-ink">{formatINR(data.expected_closing_balance)}</p>
        </div>
        <span className={`chip ${STATUS_STYLES[data.status]}`}>{t(`status.${data.status}`)}</span>
      </div>

      <div className="mt-5">
        <RangeBar
          current={data.current_cash_balance}
          worst={data.worst_case}
          expected={data.expected_closing_balance}
          best={data.best_case}
          status={data.status}
        />
      </div>

      <p className="mt-4 text-sm text-ink-muted">
        {t("dash.basedOn", { n: data.assumptions.periods_used })}
        {data.assumptions.backtest_mape_pct !== null && ` ${t("dash.backtest", { pct: data.assumptions.backtest_mape_pct })}`}
      </p>

      <button
        onClick={() => setShowHow((s) => !s)}
        aria-expanded={showHow}
        className="mt-2 inline-flex min-h-[40px] w-fit items-center gap-1 text-sm font-bold text-ink-soft hover:text-ink"
      >
        {t("dash.how")} <ChevronDown size={15} className={`transition-transform ${showHow ? "rotate-180" : ""}`} />
      </button>
      {showHow && (
        <div className="animate-fade-up space-y-1 rounded-xl bg-surface p-3.5 text-sm text-ink-soft">
          <p>
            <span className="font-bold text-ink">{t("dash.method")}:</span> {data.assumptions.method}
          </p>
          <p>
            <span className="font-bold text-ink">{t("dash.weights")}:</span> {data.assumptions.weights.join(" / ")}
          </p>
          <p>
            <span className="font-bold text-ink">{t("dash.dataUsed")}:</span> {data.assumptions.data_used}
          </p>
        </div>
      )}
    </div>
  );
}
