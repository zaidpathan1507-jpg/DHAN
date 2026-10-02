import { useI18n } from "../../lib/i18n.jsx";

export default function ConfidenceField({ label, htmlFor, confidence, children }) {
  const { t } = useI18n();
  const known = confidence !== undefined && confidence !== null && confidence > 0;
  const low = known && confidence < 70;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-soft">
          {label}
        </label>
        {known && (
          <span className={`text-xs font-bold ${low ? "text-warn" : "text-gain"}`}>
            {low ? t("txn.pleaseCheck") : t("txn.confidence", { pct: Math.round(confidence) })}
          </span>
        )}
      </div>
      <div className={low ? "rounded-xl ring-2 ring-gold-500" : ""}>{children}</div>
    </div>
  );
}
