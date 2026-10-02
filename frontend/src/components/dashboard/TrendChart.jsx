import { TrendingUp } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatINR, formatINRCompact } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Skeleton from "../common/Skeleton.jsx";

export const PERIODS = ["today", "7d", "30d", "month"];

function CustomTooltip({ active, payload, label, formatDate, t }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl bg-ink px-3.5 py-2.5 text-xs text-white shadow-elevated">
      <p className="mb-1.5 text-sm font-extrabold">{formatDate(label)}</p>
      <p className="flex justify-between gap-6">
        <span className="text-white/75">{t("common.income")}</span>
        <span className="num font-bold text-[#7FE0B5]">{formatINR(row.income)}</span>
      </p>
      <p className="flex justify-between gap-6">
        <span className="text-white/75">{t("common.expenses")}</span>
        <span className="num font-bold text-[#FF9C92]">{formatINR(row.expenses)}</span>
      </p>
      <p className="mt-1 flex justify-between gap-6 border-t border-white/15 pt-1">
        <span className="text-white/75">{t("common.net")}</span>
        <span className="num font-bold">{formatINR(row.net)}</span>
      </p>
    </div>
  );
}

export function PeriodToggle({ period, onChange }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t("dash.period")} className="inline-flex rounded-xl bg-surface-muted p-1">
      {PERIODS.map((p) => (
        <button
          key={p}
          role="radio"
          aria-checked={period === p}
          onClick={() => onChange(p)}
          className={`min-h-[36px] rounded-lg px-3 text-sm font-bold transition-colors ${
            period === p ? "bg-surface-card text-ink shadow-subtle" : "text-ink-soft hover:text-ink"
          }`}
        >
          {t(`dash.${p}`)}
        </button>
      ))}
    </div>
  );
}

export default function TrendChart({ data, loading }) {
  const { t, formatDate } = useI18n();

  return (
    <div className="card flex h-full flex-col p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">{t("dash.trend")}</h2>
        <div className="flex items-center gap-4 text-sm font-semibold text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded-full bg-gain" /> {t("common.income")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded-full bg-loss" /> {t("common.expenses")}
          </span>
        </div>
      </div>

      <div className="mt-4 min-h-[16rem] flex-1 md:min-h-[18rem]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : !data?.length ? (
          <EmptyState icon={TrendingUp} title={t("dash.trendEmpty")} body={t("dash.trendEmptyBody")} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F0B429" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#F0B429" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="#E2DFD5" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatDate(d)}
                tick={{ fontSize: 12, fill: "#566676" }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                tickMargin={10}
              />
              <YAxis
                tickFormatter={formatINRCompact}
                tick={{ fontSize: 12, fill: "#566676" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip formatDate={formatDate} t={t} />} cursor={{ stroke: "#CFCBBE" }} />
              <Area type="monotone" dataKey="net" stroke="none" fill="url(#netFill)" isAnimationActive animationDuration={700} />
              <Line type="monotone" dataKey="income" stroke="#0F7B58" strokeWidth={2.5} dot={false} isAnimationActive animationDuration={700} />
              <Line type="monotone" dataKey="expenses" stroke="#B42318" strokeWidth={2.5} dot={false} isAnimationActive animationDuration={700} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
