import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import CreditComponents from "../components/credit/CreditComponents.jsx";
import CreditGauge from "../components/credit/CreditGauge.jsx";
import ImprovementTip from "../components/credit/ImprovementTip.jsx";
import api from "../lib/apiClient.js";

const BAND_STYLES = {
  EXCELLENT: "bg-dhan-green-light text-dhan-green-dark",
  GOOD: "bg-dhan-green-light text-dhan-green-dark",
  FAIR: "bg-amber-light text-amber",
  "NEEDS WORK": "bg-danger-light text-danger",
};

export default function Credit() {
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

  if (query.isError) return <ErrorState onRetry={query.refetch} />;

  const data = query.data;

  if (data.insufficient_history) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl md:text-[32px] font-bold text-navy mb-4">Credit Readiness</h1>
        <div className="card">
          <EmptyState icon={Wallet} title="Not enough history yet." body={data.message} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-[32px] font-bold text-navy">Credit Readiness</h1>
        <p className="text-sm text-navy-soft mt-1">A financial health report built entirely from your own records.</p>
      </div>

      <div className="card p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6">
        <CreditGauge score={data.score} band={data.band} size={132} />
        <div>
          <span className={`inline-flex rounded-md px-2.5 py-1 text-sm font-semibold ${BAND_STYLES[data.band]}`}>
            {data.band}
          </span>
          <p className="mt-2 text-sm text-navy-soft leading-relaxed max-w-sm">
            This score blends five weighted components from your transaction history over the last 90 days.
          </p>
        </div>
      </div>

      <div className="card p-5 md:p-6">
        <h3 className="text-base font-semibold text-navy mb-4">Score Components</h3>
        <CreditComponents components={data.components} />
      </div>

      <ImprovementTip opportunity={data.biggest_opportunity} />

      <div className="card p-5 bg-surface-muted border-surface-border">
        <p className="text-xs text-navy-soft leading-relaxed">{data.disclaimer}</p>
      </div>
    </div>
  );
}
