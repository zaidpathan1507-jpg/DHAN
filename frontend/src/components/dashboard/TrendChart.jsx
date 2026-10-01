import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatINR } from "../../lib/constants.js";
import { SkeletonCard } from "../common/Skeleton.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { TrendingUp } from "lucide-react";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "month", label: "Month" },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-surface-border bg-navy text-white px-3.5 py-2.5 shadow-elevated text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      <p className="flex justify-between gap-4">
        <span className="text-white/60">Income</span>
        <span className="font-medium">{formatINR(row.income)}</span>
      </p>
      <p className="flex justify-between gap-4">
        <span className="text-white/60">Expenses</span>
        <span className="font-medium">{formatINR(row.expenses)}</span>
      </p>
      <p className="flex justify-between gap-4 border-t border-white/10 mt-1 pt-1">
        <span className="text-white/60">Net</span>
        <span className="font-medium">{formatINR(row.net)}</span>
      </p>
    </div>
  );
}

export default function TrendChart({ data, period, onPeriodChange, loading }) {
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-semibold text-navy">Cash Flow Trend</h3>
        <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => onPeriodChange(p.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p.key ? "bg-surface-card shadow-subtle text-navy" : "text-navy-soft"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-navy-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-dhan-green inline-block rounded-full" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-danger inline-block rounded-full" /> Expenses
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-navy/20 inline-block" /> Net
        </span>
      </div>

      <div className="mt-3 h-64">
        {loading ? (
          <SkeletonCard lines={1} />
        ) : !data?.length ? (
          <EmptyState icon={TrendingUp} title="No financial activity recorded." body="Add your first transaction to see your cash flow trend." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0E1F2E" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#0E1F2E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E3DC" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                tick={{ fontSize: 11, fill: "#2A3C4D" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                tick={{ fontSize: 11, fill: "#2A3C4D" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                content={<CustomTooltip />}
                labelFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              />
              <Area type="monotone" dataKey="net" stroke="none" fill="url(#netFill)" isAnimationActive animationDuration={600} />
              <Line type="monotone" dataKey="income" stroke="#1F8A56" strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />
              <Line type="monotone" dataKey="expenses" stroke="#C0392B" strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
