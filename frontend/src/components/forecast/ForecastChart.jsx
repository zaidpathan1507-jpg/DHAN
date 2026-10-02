import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatINR, formatINRCompact } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl bg-ink px-3.5 py-2.5 text-xs text-white shadow-elevated">
      <p className="mb-0.5 font-extrabold">{label}</p>
      <p className="num font-bold">{formatINR(row.net)}</p>
    </div>
  );
}

const SWATCH = [
  { key: "fc.legendPast", color: "#33475B" },
  { key: "fc.legendLoss", color: "#B42318" },
  { key: "fc.legendForecast", color: "#F0B429" },
];

export default function ForecastChart({ history, expectedNet }) {
  const { t, formatDate } = useI18n();
  const data = [
    ...history.map((h) => ({ label: formatDate(h.period_end), net: h.net, forecast: false })),
    { label: t("fc.next"), net: expectedNet, forecast: true },
  ];

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-semibold text-ink-soft">
        {SWATCH.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: s.color }} /> {t(s.key)}
          </li>
        ))}
      </ul>
      <div className="h-72" role="img" aria-label={t("fc.history")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="#E2DFD5" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#566676" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatINRCompact} tick={{ fontSize: 12, fill: "#566676" }} axisLine={false} tickLine={false} width={52} />
            <ReferenceLine y={0} stroke="#CFCBBE" />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F5F4EF" }} />
            <Bar dataKey="net" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.forecast ? "#F0B429" : d.net >= 0 ? "#33475B" : "#B42318"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
