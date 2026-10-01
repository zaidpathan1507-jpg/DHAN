import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import InsightCard from "../components/insights/InsightCard.jsx";
import api from "../lib/apiClient.js";

const SECTIONS = [
  { key: "needs_attention", title: "Needs Attention" },
  { key: "spending_pattern", title: "Spending Patterns" },
  { key: "savings_opportunity", title: "Savings Opportunities" },
];

export default function Insights() {
  const query = useQuery({
    queryKey: ["insights"],
    queryFn: () => api.get("/insights").then((r) => r.data),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-[32px] font-bold text-navy">Financial Intelligence</h1>
        <p className="text-sm text-navy-soft mt-1">DHAN found these patterns in your business.</p>
      </div>

      {query.isLoading ? (
        <SkeletonCard lines={6} />
      ) : query.isError ? (
        <ErrorState onRetry={query.refetch} />
      ) : !query.data?.length ? (
        <EmptyState icon={Sparkles} title="No insights yet." body="Add more transactions and DHAN will surface patterns here." />
      ) : (
        SECTIONS.map((section) => {
          const items = query.data.filter((i) => i.type === section.key);
          if (!items.length) return null;
          return (
            <div key={section.key}>
              <h2 className="text-sm font-semibold text-navy-soft/70 mb-3">{section.title.toUpperCase()}</h2>
              <div className="space-y-3">
                {items.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
