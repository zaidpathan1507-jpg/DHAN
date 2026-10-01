import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Info, TrendingDown, TrendingUp } from "lucide-react";

import api from "../../lib/apiClient.js";

const SEVERITY_STYLES = {
  high: { border: "border-danger/25", badge: "bg-danger-light text-danger", icon: AlertTriangle },
  warning: { border: "border-amber/25", badge: "bg-amber-light text-amber", icon: AlertTriangle },
  normal: { border: "border-dhan-green/20", badge: "bg-dhan-green-light text-dhan-green-dark", icon: TrendingDown },
};

const TYPE_ICON = {
  spending_pattern: TrendingUp,
  savings_opportunity: TrendingDown,
  needs_attention: AlertTriangle,
};

export default function InsightCard({ insight }) {
  const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.normal;
  const Icon = TYPE_ICON[insight.type] || Info;
  const queryClient = useQueryClient();

  const reviewMutation = useMutation({
    mutationFn: (status) => api.patch(`/transactions/${insight.txn_id}`, { description: `Reviewed: ${status}` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["insights"] }),
  });

  return (
    <div className={`card border p-4 md:p-5 ${style.border} animate-fade-up`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.badge}`}>
          <Icon size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-navy-soft/70">{insight.title}</p>
            <span className={`shrink-0 text-base font-bold tabular-nums ${style.badge.split(" ")[1]}`}>
              {insight.headline}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-navy leading-relaxed">{insight.body}</p>

          {insight.txn_id ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => reviewMutation.mutate("expected")}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-navy-soft hover:bg-surface-muted"
              >
                Expected
              </button>
              <button
                onClick={() => reviewMutation.mutate("needs review")}
                className="rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-soft"
              >
                Needs Review
              </button>
            </div>
          ) : (
            insight.action && <p className="mt-2 text-xs font-medium text-navy-soft">{insight.action}</p>
          )}

          <p className="mt-2 text-[11px] text-navy-soft/40">Method: {insight.method}</p>
        </div>
      </div>
    </div>
  );
}
