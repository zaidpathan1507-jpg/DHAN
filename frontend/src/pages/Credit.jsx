import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import CreditComponents from "../components/credit/CreditComponents.jsx";
import CreditGauge, { BAND_CHIP } from "../components/credit/CreditGauge.jsx";
import PassportPanel from "../components/credit/PassportPanel.jsx";
import ImprovementTip from "../components/credit/ImprovementTip.jsx";
import api from "../lib/apiClient.js";
import { useI18n } from "../lib/i18n.jsx";

export default function Credit() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["credit-readiness"],
    queryFn: () => api.get("/credit-readiness").then((r) => r.data),
  });

  if (query.isLoading) {
    return (
      <div className="max-w-3xl">
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
        <PageHeader title={t("cr.title")} />
        <div className="card">
          <EmptyState icon={Wallet} title={t("dash.noHistory")} body={data.message} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("cr.title")} subtitle={t("cr.sub")} />

      <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row md:p-8">
        <CreditGauge score={data.score} band={data.band} width={240} />
        <div className="text-center sm:text-left">
          <span className={`chip px-3.5 py-1.5 text-base ${BAND_CHIP[data.band]}`}>{t(`band.${data.band}`)}</span>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">{t("cr.blend")}</p>
        </div>
      </div>

      <div className="card p-5 md:p-6">
        <h2 className="mb-5 text-lg font-extrabold text-ink">{t("cr.components")}</h2>
        <CreditComponents components={data.components} />
      </div>

      <ImprovementTip opportunity={data.biggest_opportunity} />

      <PassportPanel />

      <p className="rounded-2xl bg-surface-muted p-4 text-sm leading-relaxed text-ink-soft">{data.disclaimer}</p>
    </div>
  );
}
