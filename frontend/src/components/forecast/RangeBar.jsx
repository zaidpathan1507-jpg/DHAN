import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

const STATUS_FILL = {
  HEALTHY: "bg-gain/25",
  WATCH: "bg-gold-500/40",
  "AT RISK": "bg-loss/25",
};

// Where the balance is now vs. the likely worst / expected / best outcome after 30 days, on one scale.
// `domain` lets two bars share one scale so they can be compared side by side.
export default function RangeBar({ current, worst, expected, best, status, large = false, domain }) {
  const { t } = useI18n();
  const crossesZero = worst < 0;
  const values = [current, worst, expected, best, ...(crossesZero ? [0] : [])];
  const lo = domain ? domain[0] : Math.min(...values);
  const hi = domain ? domain[1] : Math.max(...values);
  const pad = domain ? 0 : (hi - lo) * 0.08 || 1;
  const min = lo - pad;
  const span = hi + pad - min;
  const pos = (v) => `${((v - min) / span) * 100}%`;

  return (
    <div>
      <div className={`relative ${large ? "h-14" : "h-12"}`} role="img" aria-label={t("fc.range")}>
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-surface-muted" />
        <div
          className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${STATUS_FILL[status] || "bg-gold-500/40"}`}
          style={{ left: pos(worst), width: `calc(${pos(best)} - ${pos(worst)})` }}
        />
        {crossesZero && (
          <div className="absolute inset-y-1 w-px bg-loss" style={{ left: pos(0) }} title="₹0" />
        )}
        <div className="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-muted" style={{ left: pos(current) }} />
        <div
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-ink shadow-card"
          style={{ left: pos(expected) }}
        />
      </div>

      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs font-semibold text-ink-muted">{t("dash.worst")}</dt>
          <dd className={`num font-extrabold ${worst < 0 ? "text-loss" : "text-ink"}`}>{formatINR(worst)}</dd>
        </div>
        <div className="text-center">
          <dt className="text-xs font-semibold text-ink-muted">{t("dash.expected")}</dt>
          <dd className="num font-extrabold text-ink">{formatINR(expected)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs font-semibold text-ink-muted">{t("dash.best")}</dt>
          <dd className="num font-extrabold text-gain">{formatINR(best)}</dd>
        </div>
      </dl>
    </div>
  );
}
