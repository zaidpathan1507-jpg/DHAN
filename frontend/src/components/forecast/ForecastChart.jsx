import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatINR } from "../../lib/constants.js";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-surface-border bg-navy text-white px-3.5 py-2.5 shadow-elevated text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p>{formatINR(row.net)}</p>
    </div>
  );
}

export default function ForecastChart({ history, expectedNet }) {
  const data = [
    ...history.map((h) => ({
      label: new Date(h.period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      net: h.net,
      forecast: false,
    })),
    { label: "Next 30d", net: expectedNet, forecast: true },
  ];

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E3DC" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#2A3C4D" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11, fill: "#2A3C4D" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="net" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={600}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.forecast ? "#1F8A56" : d.net >= 0 ? "#2A3C4D" : "#C0392B"} fillOpacity={d.forecast ? 1 : 0.75} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
