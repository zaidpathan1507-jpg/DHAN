import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Info, TrendingDown, TrendingUp, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";

import api from "../../lib/apiClient.js";
import { sentenceCase } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

const SEVERITY = {
  high: { chip: "bg-loss-soft text-loss", text: "text-loss" },
  warning: { chip: "bg-warn-soft text-warn", text: "text-warn" },
  normal: { chip: "bg-gain-soft text-gain-ink", text: "text-gain" },
};

const TYPE_ICON = {
  spending_pattern: TrendingUp,
  savings_opportunity: TrendingDown,
  needs_attention: AlertTriangle,
};

export default function InsightCard({ insight }) {
  const style = SEVERITY[insight.severity] || SEVERITY.normal;
  const Icon = TYPE_ICON[insight.type] || Info;
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const reviewMutation = useMutation({
    mutationFn: (status) => api.patch(`/transactions/${insight.txn_id}`, { description: `Reviewed: ${status}` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["insights"] }),
  });

  return (
    <article className="rounded-2xl border border-surface-border bg-surface-card p-4 shadow-subtle animate-fade-up md:p-5">
      <div className="flex items-start gap-3.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.chip}`}>
          <Icon size={19} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-extrabold text-ink">{sentenceCase(insight.title)}</h3>
            <span className={`num shrink-0 text-lg font-extrabold ${style.text}`}>{insight.headline}</span>
          </div>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{insight.body}</p>

          {insight.txn_id ? (
            <div className="mt-3.5 flex flex-wrap gap-2">
              <button
                onClick={() => reviewMutation.mutate("expected")}
                disabled={reviewMutation.isPending}
                className="btn-secondary min-h-[40px] px-3.5 py-2"
              >
                {t("ins.expected")}
              </button>
              <button
                onClick={() => reviewMutation.mutate("needs review")}
                disabled={reviewMutation.isPending}
                className="btn-ink min-h-[40px] px-3.5 py-2"
              >
                {t("ins.needsReview")}
              </button>
            </div>
          ) : (
            insight.action && <p className="mt-2.5 text-sm font-bold text-ink">{insight.action}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">{t("ins.method", { method: insight.method })}</p>
            <Link to={`/ask?q=${encodeURIComponent(`${t("ai.askWhy")}: ${sentenceCase(insight.title)} ${insight.headline}`)}`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold text-gold-700 hover:bg-gold-50">
              <WandSparkles size={14} /> {t("ai.askWhy")}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
