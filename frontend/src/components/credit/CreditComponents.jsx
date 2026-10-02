import { useI18n } from "../../lib/i18n.jsx";

function barColor(score) {
  if (score >= 70) return "#0F7B58";
  if (score >= 50) return "#D9990B";
  return "#B42318";
}

export default function CreditComponents({ components }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-5">
      {components.map((c) => (
        <li key={c.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold text-ink">{c.label}</span>
            <span className="num text-[15px] font-extrabold text-ink">
              {c.score} <span className="text-xs font-semibold text-ink-muted">· {t("cr.weight", { pct: Math.round(c.weight * 100) })}</span>
            </span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-valuenow={Math.round(c.score)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={c.label}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${c.score}%`, backgroundColor: barColor(c.score) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
