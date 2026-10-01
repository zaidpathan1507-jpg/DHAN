import { PieChart as PieIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatINR } from "../../lib/constants.js";
import EmptyState from "../common/EmptyState.jsx";
import { SkeletonCard } from "../common/Skeleton.jsx";

const PALETTE = ["#1F8A56", "#2A3C4D", "#B8860B", "#2563A8", "#6B8F7A", "#8A6D3B", "#4A6B8A", "#7A5C6B", "#5C7A6B", "#9A8C78"];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-surface-border bg-navy text-white px-3.5 py-2.5 shadow-elevated text-xs">
      <p className="font-semibold">{row.category}</p>
      <p className="text-white/70 mt-0.5">
        {formatINR(row.amount)} · {row.pct}%
      </p>
    </div>
  );
}

export default function SpendingBreakdown({ data, loading }) {
  return (
    <div className="card p-5 md:p-6 h-full">
      <h3 className="text-base font-semibold text-navy">Spending Mix</h3>

      {loading ? (
        <div className="mt-4">
          <SkeletonCard lines={2} />
        </div>
      ) : !data?.length ? (
        <EmptyState icon={PieIcon} title="No spending yet." body="Expenses you add will show up here by category." />
      ) : (
        <>
          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius="60%"
                  outerRadius="90%"
                  paddingAngle={2}
                  isAnimationActive
                  animationDuration={600}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.category} fill={PALETTE[i % PALETTE.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-2.5">
            {data.slice(0, 6).map((row, i) => (
              <li key={row.category} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-navy-soft truncate">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="truncate">{row.category}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-medium text-navy tabular-nums">{formatINR(row.amount)}</span>
                  <span className="text-navy-soft/60 text-xs w-10 text-right">{row.pct}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
