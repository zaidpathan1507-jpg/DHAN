import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import api from "../../lib/apiClient.js";
import { formatINR, formatINRCompact } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import RangeBar from "./RangeBar.jsx";

const ZERO = { sales: 0, costs: 0, oneTime: 0 };
const PRESETS = [
  ["wi.p.slow", { ...ZERO, sales: -20 }],
  ["wi.p.festive", { ...ZERO, sales: 25, costs: 10 }],
  ["wi.p.loan", { ...ZERO, oneTime: 1000000 }],
  ["wi.p.equip", { ...ZERO, oneTime: -300000 }],
];

function Slider({ id, label, value, min, max, step, onChange, display, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-bold text-ink">
          {label}
        </label>
        <output htmlFor={id} className={`num rounded-lg px-2.5 py-0.5 text-sm font-extrabold ${value ? "bg-gold-100 text-gold-700" : "bg-surface-muted text-ink-soft"}`}>
          {display}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 h-8 w-full cursor-pointer" />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

// same thresholds as the backend forecast status
const statusOf = (c) => (c.expected < 0 ? "AT RISK" : c.worst < 0 ? "WATCH" : "HEALTHY");
const signed = (v, suffix = "") => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}${suffix}`;

export default function WhatIf() {
  const { t } = useI18n();
  const [s, setS] = useState(ZERO);
  const [debounced, setDebounced] = useState(ZERO);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(s), 220);
    return () => clearTimeout(id);
  }, [s]);

  const query = useQuery({
    queryKey: ["whatif", debounced],
    queryFn: () => api.post("/forecast/simulate", { sales_pct: debounced.sales, cost_pct: debounced.costs, one_time: debounced.oneTime }).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
  const d = query.data;
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));

  // one shared scale for both bars (include ₹0 only when a case dips below it)
  let domain;
  if (d && !d.insufficient_history) {
    const all = [d.current_cash_balance, d.baseline.worst, d.baseline.best, d.scenario.worst, d.scenario.best];
    if (Math.min(...all) < 0) all.push(0);
    const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.06 || 1;
    domain = [lo - pad, hi + pad];
  }
  const diff = d ? d.scenario.expected - d.baseline.expected : 0;

  return (
    <section className="card p-5 md:p-6" aria-labelledby="whatif-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="whatif-title" className="text-lg font-extrabold text-ink">{t("wi.title")}</h2>
          <p className="mt-0.5 text-[15px] text-ink-soft">{t("wi.sub")}</p>
        </div>
        <button onClick={() => setS(ZERO)} disabled={s === ZERO || (!s.sales && !s.costs && !s.oneTime)} className="btn-secondary min-h-[40px] px-3 py-2">
          <RotateCcw size={15} /> {t("wi.reset")}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map(([key, preset]) => (
          <button key={key} onClick={() => setS(preset)} className="min-h-[40px] rounded-full border border-surface-strong bg-surface-card px-3.5 text-sm font-bold text-ink-soft hover:bg-gold-50 hover:text-ink">
            {t(key)}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-3">
        <Slider id="wi-sales" label={t("wi.sales")} value={s.sales} min={-50} max={50} step={5} onChange={set("sales")} display={signed(s.sales, "%")} />
        <Slider id="wi-costs" label={t("wi.costs")} value={s.costs} min={-30} max={50} step={5} onChange={set("costs")} display={signed(s.costs, "%")} />
        <Slider
          id="wi-once"
          label={t("wi.oneTime")}
          value={s.oneTime}
          min={-2000000}
          max={2000000}
          step={50000}
          onChange={set("oneTime")}
          display={`${s.oneTime > 0 ? "+" : s.oneTime < 0 ? "−" : ""}${formatINRCompact(Math.abs(s.oneTime))}`}
          hint={t("wi.oneTimeHint")}
        />
      </div>

      {d && !d.insufficient_history && (
        <div className="mt-6 space-y-5 border-t border-surface-border pt-5" aria-live="polite">
          <div>
            <p className="text-sm font-bold text-ink-muted">{t("wi.today")}</p>
            <RangeBar current={d.current_cash_balance} worst={d.baseline.worst} expected={d.baseline.expected} best={d.baseline.best} status={statusOf(d.baseline)} domain={domain} />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">{t("wi.with")}</p>
            <RangeBar current={d.current_cash_balance} worst={d.scenario.worst} expected={d.scenario.expected} best={d.scenario.best} status={statusOf(d.scenario)} domain={domain} />
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="text-sm font-semibold text-ink-muted">{t("wi.expected")}</p>
            <p className="num text-[30px] font-extrabold leading-tight text-ink">{formatINR(d.scenario.expected)}</p>
            <p className={`mt-1 text-[15px] font-bold ${Math.abs(diff) < 1 ? "text-ink-soft" : diff > 0 ? "text-gain" : "text-loss"}`}>
              {Math.abs(diff) < 1 ? t("wi.same") : t(diff > 0 ? "wi.diffUp" : "wi.diffDown", { amount: formatINR(Math.abs(diff)) })}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{d.runway_months ? t("wi.runway", { n: d.runway_months }) : t("wi.growing")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
