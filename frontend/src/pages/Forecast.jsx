import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import { STATUS_STYLES } from "../components/dashboard/ForecastCard.jsx";
import ForecastAssumptions from "../components/forecast/ForecastAssumptions.jsx";
import WhatIf from "../components/forecast/WhatIf.jsx";
import ForecastChart from "../components/forecast/ForecastChart.jsx";
import RangeBar from "../components/forecast/RangeBar.jsx";
import api from "../lib/apiClient.js";
import { formatINR } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";

export default function Forecast() {
  const { t, tr } = useI18n();
  const query = useQuery({
    queryKey: ["forecast"],
    queryFn: () => api.get("/forecast").then((r) => r.data),
  });

  if (query.isLoading) {
    return (
      <div className="max-w-5xl">
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="card max-w-xl">
        <ErrorState onRetry={query.refetch} />
      </div>
    );
  }

  const data = query.data;

  if (data.insufficient_history) {
    return (
      <div className="max-w-xl space-y-5">
        <PageHeader title={t("fc.title")} />
        <div className="card">
          <EmptyState icon={TrendingUp} title={t("dash.noHistory")} body={data.message} />
        </div>
      </div>
    );
  }

  const expectedNet = data.expected_closing_balance - data.current_cash_balance;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("fc.title")} subtitle={t("fc.sub")} />

      <div className="grid gap-5 md:gap-6 lg:grid-cols-3">
        <div className="card p-5 md:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-muted">{t("fc.expectedClose")}</p>
              <p className="num text-[38px] font-extrabold leading-tight text-ink">{formatINR(data.expected_closing_balance)}</p>
            </div>
            <span className={`chip text-sm ${STATUS_STYLES[data.status]}`}>{t(`status.${data.status}`)}</span>
          </div>

          <h2 className="mb-1 mt-6 text-base font-extrabold text-ink">{t("fc.range")}</h2>
          <RangeBar
            large
            current={data.current_cash_balance}
            worst={data.worst_case}
            expected={data.expected_closing_balance}
            best={data.best_case}
            status={data.status}
          />

          <h2 className="mb-3 mt-8 text-base font-extrabold text-ink">{t("fc.history")}</h2>
          <ForecastChart history={data.history} expectedNet={expectedNet} />
        </div>

        <ForecastAssumptions assumptions={data.assumptions} />
      </div>

      <WhatIf />

      <div className="card p-5 md:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t("fc.byCategory")}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t("fc.excluding")}</p>
        {!data.category_forecast?.length ? (
          <p className="mt-4 text-[15px] text-ink-soft">{t("fc.noCategory")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-surface-border">
            {data.category_forecast.map((c) => (
              <li key={c.category} className="flex items-center justify-between gap-3 py-3 text-[15px]">
                <span className="font-semibold text-ink-soft">{tr("cat", c.category)}</span>
                <span className="num font-extrabold text-ink">{formatINR(c.expected_amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
