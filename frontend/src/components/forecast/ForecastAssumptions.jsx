export default function ForecastAssumptions({ assumptions }) {
  return (
    <div className="card p-5 md:p-6">
      <h3 className="text-base font-semibold text-navy">Forecast Assumptions</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Method" value={assumptions.method} />
        <Row label="Data used" value={assumptions.data_used} />
        <Row label="Weights" value={assumptions.weights.map((w) => Math.round(w * 100)).join(" / ")} />
        <Row
          label="Backtest MAPE"
          value={assumptions.backtest_mape_pct !== null ? `${assumptions.backtest_mape_pct}%` : "Not enough history yet"}
        />
      </dl>
      <p className="mt-4 text-[11px] text-navy-soft/50 leading-relaxed">
        Weights are applied oldest → newest to the last 3 rolling 30-day periods, plus a simple trend term.
      </p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border pb-3 last:border-0 last:pb-0">
      <dt className="text-navy-soft/70">{label}</dt>
      <dd className="font-medium text-navy text-right">{value}</dd>
    </div>
  );
}
