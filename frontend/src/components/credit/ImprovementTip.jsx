import { Lightbulb } from "lucide-react";

export default function ImprovementTip({ opportunity }) {
  return (
    <div className="card p-5 md:p-6 bg-dhan-green-light border-dhan-green/15">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-card text-dhan-green-dark">
          <Lightbulb size={16} strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-dhan-green-dark/70">
            Your biggest opportunity
          </p>
          <p className="mt-1 text-sm font-semibold text-navy">{opportunity.label}</p>
          <p className="mt-1 text-sm text-navy-soft leading-relaxed">{opportunity.tip}</p>
        </div>
      </div>
    </div>
  );
}
