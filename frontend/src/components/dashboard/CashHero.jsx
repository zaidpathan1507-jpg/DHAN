import { AlertTriangle, ArrowRight, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";

import { formatINR, formatPct, sentenceCase } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useCountUp } from "../../lib/useCountUp.js";

const STATUS_CHIP = {
  HEALTHY: "bg-[#CFF1E1] text-gain-ink",
  WATCH: "bg-gold-100 text-gold-700",
  "AT RISK": "bg-[#FFD9D4] text-loss",
};

// One sentence that answers "am I okay?" before the owner reads a single chart.
function pulse(forecast, t) {
  if (!forecast) return { text: "…", status: null };
  if (forecast.insufficient_history) return { text: t("dash.pulseNone"), status: null };
  const { status } = forecast;
  if (status === "AT RISK") return { text: t("dash.pulseRisk", { amount: formatINR(forecast.expected_closing_balance) }), status };
  if (status === "WATCH") return { text: t("dash.pulseWatch", { amount: formatINR(forecast.worst_case) }), status };
  return { text: t("dash.pulseHealthy", { amount: formatINR(forecast.expected_closing_balance) }), status };
}

export default function CashHero({ overview, forecast, insights }) {
  const { t } = useI18n();
  const balance = overview?.cash_balance;
  const animated = useCountUp(balance?.amount);
  const spark = (balance?.sparkline || []).map((v, i) => ({ i, v }));
  const { text, status } = pulse(forecast, t);
  const top = insights?.[0];
  const change = balance?.pct_change;
  const up = change !== null && change !== undefined && change >= 0;

  return (
    <section
      aria-label={t("dash.cashHeroLabel")}
      className="relative overflow-hidden rounded-3xl bg-ink text-white shadow-hero"
      style={{
        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 39px, rgba(255,255,255,0.04) 39px 40px)",
      }}
    >
      <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <p className="text-[15px] font-semibold text-white/80">{t("dash.cashHeroLabel")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="num text-[44px] font-extrabold leading-none tracking-tight md:text-[60px]">
              {balance ? formatINR(animated) : "—"}
            </p>
            {change !== null && change !== undefined && (
              <span className={`chip ${up ? "bg-[#CFF1E1] text-gain-ink" : "bg-[#FFD9D4] text-loss"}`}>
                {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {formatPct(change)}
              </span>
            )}
          </div>

          <p className="mt-5 max-w-xl text-lg font-semibold leading-snug text-white md:text-xl">
            {status && (
              <span className={`chip mr-2 align-middle ${STATUS_CHIP[status]}`}>{t(`status.${status}`)}</span>
            )}
            {text}
          </p>
        </div>

        <div className="h-36 lg:h-44" aria-hidden="true">
          {spark.length > 2 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 6, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F0B429" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#F0B429" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#F6C244"
                  strokeWidth={3}
                  fill="url(#heroFill)"
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 bg-ink-deep/40 px-6 py-3.5 md:px-8">
        {top ? (
          <p className="flex min-w-0 items-start gap-2.5 text-[15px]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold-400" aria-hidden="true" />
            <span>
              <span className="font-bold text-gold-400">{t("dash.attention")}:</span>{" "}
              <span className="font-semibold text-white">
                {sentenceCase(top.title)} {top.headline}
              </span>
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-2.5 text-[15px] font-semibold text-white/85">
            <CheckCircle2 size={18} className="text-[#7FE0B5]" aria-hidden="true" /> {t("dash.allClear")}
          </p>
        )}
        <Link
          to="/insights"
          className="inline-flex min-h-[40px] items-center gap-1.5 text-[15px] font-bold text-white underline decoration-gold-500 decoration-2 underline-offset-4 hover:text-gold-400"
        >
          {t("dash.seeInsights")} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
