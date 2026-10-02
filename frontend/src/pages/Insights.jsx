import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import InsightCard from "../components/insights/InsightCard.jsx";
import api from "../lib/apiClient.js";
import { useI18n } from "../lib/i18n.jsx";

const SECTIONS = ["needs_attention", "spending_pattern", "savings_opportunity"];

export default function Insights() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["insights"],
    queryFn: () => api.get("/insights").then((r) => r.data),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("ins.title")} subtitle={t("ins.sub")} />

      {query.isLoading ? (
        <SkeletonCard lines={6} />
      ) : query.isError ? (
        <div className="card">
          <ErrorState onRetry={query.refetch} />
        </div>
      ) : !query.data?.length ? (
        <div className="card">
          <EmptyState icon={Sparkles} title={t("ins.empty")} body={t("ins.emptyBody")} />
        </div>
      ) : (
        SECTIONS.map((key) => {
          const items = query.data.filter((i) => i.type === key);
          if (!items.length) return null;
          return (
            <section key={key} aria-labelledby={`sec-${key}`}>
              <h2 id={`sec-${key}`} className="mb-3 flex items-center gap-2 text-lg font-extrabold text-ink">
                {t(`ins.${key}`)}
                <span className="num rounded-full bg-surface-muted px-2.5 py-0.5 text-sm font-bold text-ink-soft">{items.length}</span>
              </h2>
              <div className="space-y-3">
                {items.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
