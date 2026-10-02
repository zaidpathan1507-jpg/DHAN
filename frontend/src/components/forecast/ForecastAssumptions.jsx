import { useI18n } from "../../lib/i18n.jsx";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  );
}

export default function ForecastAssumptions({ assumptions }) {
  const { t } = useI18n();
  return (
    <div className="card h-full p-5 md:p-6">
      <h2 className="text-lg font-extrabold text-ink">{t("fc.assumptions")}</h2>
      <dl className="mt-4 space-y-3 text-[15px]">
        <Row label={t("fc.method")} value={assumptions.method} />
        <Row label={t("fc.dataUsed")} value={assumptions.data_used} />
        <Row label={t("fc.weights")} value={assumptions.weights.map((w) => Math.round(w * 100)).join(" / ")} />
        <Row
          label={t("fc.mape")}
          value={assumptions.backtest_mape_pct !== null ? `${assumptions.backtest_mape_pct}%` : t("fc.noMape")}
        />
      </dl>
      <p className="mt-4 text-sm text-ink-muted">{t("fc.note")}</p>
    </div>
  );
}
