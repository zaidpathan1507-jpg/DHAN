import { PieChart as PieIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Skeleton from "../common/Skeleton.jsx";

// Hue-distinct on a light ground; the list beside the donut carries the labels so colour is never the only cue.
export const PALETTE = ["#0B1B2B", "#F0B429", "#0F7B58", "#B42318", "#1D5FA8", "#7A4FA3", "#D9780B", "#2A9D9D", "#8A6D3B", "#8895A3"];

function CustomTooltip({ active, payload, tr }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl bg-ink px-3.5 py-2.5 text-xs text-white shadow-elevated">
      <p className="font-extrabold">{tr("cat", row.category)}</p>
      <p className="num mt-0.5 text-white/80">
        {formatINR(row.amount)} · {row.pct}%
      </p>
    </div>
  );
}

export default function SpendingBreakdown({ data, loading }) {
  const { t, tr } = useI18n();
  const total = data?.reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <div className="card h-full p-5 md:p-6">
      <h2 className="text-lg font-extrabold text-ink">{t("dash.mix")}</h2>

      {loading ? (
        <Skeleton className="mt-4 h-64 w-full" />
      ) : !data?.length ? (
        <EmptyState icon={PieIcon} title={t("dash.mixEmpty")} body={t("dash.mixEmptyBody")} />
      ) : (
        <>
          <div className="relative mt-3 h-44" role="img" aria-label={t("dash.mix")}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius="70%"
                  outerRadius="94%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive
                  animationDuration={800}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.category} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip tr={tr} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-semibold text-ink-muted">{t("common.expenses")}</span>
              <span className="num text-[15px] font-extrabold text-ink">{formatINR(total)}</span>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {data.slice(0, 6).map((row, i) => (
              <li key={row.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2.5 text-ink-soft">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate font-semibold">{tr("cat", row.category)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="num font-bold text-ink">{formatINR(row.amount)}</span>
                  <span className="num w-11 text-right text-xs font-semibold text-ink-muted">{row.pct}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
