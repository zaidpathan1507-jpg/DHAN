import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { formatINR, formatPct } from "../../lib/constants.js";
import { useCountUp } from "../../lib/useCountUp.js";

export default function KpiCard({ label, amount, pctChange, sparkline, tone = "neutral" }) {
  const animated = useCountUp(amount);
  const positive = pctChange !== null && pctChange !== undefined && pctChange >= 0;
  const sparkData = (sparkline || []).map((v, i) => ({ i, v }));

  const sparkColor = tone === "danger" ? "#C0392B" : "#1F8A56";

  return (
    <div className="card p-5 flex flex-col gap-3 animate-fade-up">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-soft/70">{label}</p>
      <p className="text-[28px] md:text-[32px] font-bold text-navy tabular-nums leading-none">
        {formatINR(animated)}
      </p>
      <div className="flex items-center justify-between">
        {pctChange !== null && pctChange !== undefined ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              positive ? "text-dhan-green" : "text-danger"
            }`}
          >
            {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {formatPct(pctChange)}
          </span>
        ) : (
          <span className="text-xs text-navy-soft/50">vs previous period</span>
        )}
        {sparkData.length > 2 && (
          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.75}
                  fill={`url(#spark-${label})`}
                  isAnimationActive={true}
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
