import { Lightbulb } from "lucide-react";

import { useI18n } from "../../lib/i18n.jsx";

export default function ImprovementTip({ opportunity }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl bg-gold-50 p-5 md:p-6">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-ink">
          <Lightbulb size={19} strokeWidth={2} />
        </span>
        <div>
          <h3 className="text-base font-extrabold text-ink">{t("cr.opp")}</h3>
          <p className="mt-1 text-[15px] font-bold text-ink">{opportunity.label}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{opportunity.tip}</p>
        </div>
      </div>
    </div>
  );
}
