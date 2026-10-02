import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronDown, LifeBuoy, RotateCcw, Siren } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import { useToast } from "../components/common/Toast.jsx";
import api from "../lib/apiClient.js";
import { formatINR, formatINRCompact } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";

const ZERO = { sales: 0, costs: 0 };
const PRESETS = [
  ["cc.pSlow", { sales: -25, costs: 0 }],
  ["cc.pCosts", { sales: 0, costs: 20 }],
  ["cc.pBad", { sales: -60, costs: 40 }],
];

function Slider({ id, label, value, min, max, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[15px] font-bold text-ink">{label}</label>
        <output htmlFor={id} className={`num rounded-lg px-2.5 py-0.5 text-sm font-extrabold ${value ? "bg-gold-100 text-gold-700" : "bg-surface-muted text-ink-soft"}`}>{value > 0 ? "+" : value < 0 ? "−" : ""}{Math.abs(value)}%</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 h-8 w-full cursor-pointer" />
    </div>
  );
}

// Dots on days with a bill (red) or an expected invoice (green).
function EventDot({ cx, cy, payload }) {
  if (!payload?.events?.length || cx == null) return null;
  const bill = payload.events.some((e) => e.type === "payable");
  return <circle cx={cx} cy={cy} r={5} fill={bill ? "#B42318" : "#0F7B58"} stroke="#fff" strokeWidth={2} />;
}

function ChartTooltip({ active, payload, formatDate, t }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="max-w-[240px] rounded-xl bg-ink px-3.5 py-2.5 text-xs text-white shadow-elevated">
      <p className="text-sm font-extrabold">{formatDate(p.date, { weekday: "short", day: "numeric", month: "short" })}</p>
      <p className="num mt-0.5 text-base font-extrabold text-gold-400">{formatINR(p.balance)}</p>
      {p.events?.map((e, i) => (
        <p key={i} className="mt-1 flex justify-between gap-3">
          <span className={e.type === "payable" ? "text-[#FF9C92]" : "text-[#7FE0B5]"}>{e.type === "payable" ? t("cc.legendBill") : t("cc.legendInvoice")}: {e.party}</span>
          <span className="num font-bold">{formatINR(e.amount)}</span>
        </p>
      ))}
    </div>
  );
}

export default function CashCalendar() {
  const { t, formatDate } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [s, setS] = useState(ZERO);
  const [debounced, setDebounced] = useState(ZERO);
  const [showHow, setShowHow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(s), 250);
    return () => clearTimeout(id);
  }, [s]);

  const query = useQuery({
    queryKey: ["cash-calendar", debounced],
    queryFn: () => api.get("/cash-calendar", { params: { days: 45, sales_pct: debounced.sales, cost_pct: debounced.costs } }).then((r) => r.data),
    placeholderData: (previous) => previous,
  });

  const remind = useMutation({
    mutationFn: async (items) => {
      const results = await Promise.allSettled(items.map((i) => api.post(`/receivables/${i.id}/send`, { channels: ["email", "whatsapp"], step: i.days_overdue >= 7 ? "late7" : i.days_overdue > 0 ? "late3" : "pre" })));
      return results.filter((r) => r.status === "fulfilled").length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      showToast(n ? t("cc.reminded", { n }) : t("cc.remindFail"), n ? "success" : "error");
    },
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (query.isError) return <div className="card"><ErrorState onRetry={query.refetch} /></div>;
  const c = query.data;
  if (c.insufficient_history) {
    return (
      <div className="max-w-xl space-y-5">
        <PageHeader title={t("cc.title")} />
        <div className="card"><EmptyState icon={CalendarRange} title={t("cc.title")} body={t("cc.insufficient")} /></div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const data = [{ date: today, balance: c.current, events: [] }, ...c.series];
  const crunch = c.crunch;
  const lo = Math.min(0, c.lowest.balance, c.buffer);
  const hi = Math.max(...data.map((d) => d.balance), c.buffer);
  const pad = (hi - lo) * 0.08;
  const bills = c.series.flatMap((d) => d.events.filter((e) => e.type === "payable").map((e) => ({ ...e, date: d.date })));
  const owed = c.series.flatMap((d) => d.events.filter((e) => e.type === "receivable").map((e) => ({ ...e, date: d.date })));
  const tone = !crunch ? "safe" : crunch.level === "critical" ? "crit" : "warn";
  const heroStyle = { safe: "bg-gain-soft text-gain-ink", warn: "bg-gold-50 text-ink", crit: "bg-loss-soft text-loss" }[tone];
  const Icon = { safe: CheckCircle2, warn: AlertTriangle, crit: Siren }[tone];
  const amt = formatINR(c.lowest.balance);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("cc.title")} subtitle={t("cc.sub")} />

      <section className={`flex items-start gap-4 rounded-2xl p-5 md:p-6 ${heroStyle}`} aria-live="polite">
        <Icon size={32} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="text-xl font-extrabold md:text-2xl">
            {tone === "safe" && t("cc.safeTitle", { n: c.series.length })}
            {tone === "warn" && t("cc.warnTitle", { date: formatDate(crunch.date, { day: "numeric", month: "short" }) })}
            {tone === "crit" && t("cc.critTitle", { date: formatDate(crunch.date, { day: "numeric", month: "short" }) })}
          </h2>
          <p className="mt-1 text-[15px] font-semibold opacity-90">
            {tone === "safe" && t("cc.safeBody", { amount: amt, date: formatDate(c.lowest.date, { day: "numeric", month: "short" }) })}
            {tone === "warn" && t("cc.warnBody", { n: crunch.days_away, buffer: formatINR(c.buffer), amount: amt })}
            {tone === "crit" && t("cc.critBody", { n: crunch.days_away })}
          </p>
          {crunch && <p className="num mt-2 text-sm font-extrabold">{t("cc.shortBy", { amount: formatINR(crunch.shortfall) })}</p>}
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-ink">{t("cc.chart")}</h2>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-ink-soft">
            <li className="flex items-center gap-1.5"><span className="inline-block h-1 w-4 rounded-full bg-ink" /> {t("cc.legendBalance")}</li>
            <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-loss" /> {t("cc.legendBill")}</li>
            <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-gain" /> {t("cc.legendInvoice")}</li>
          </ul>
        </div>
        <div className="mt-4 h-72 md:h-80" role="img" aria-label={t("cc.chart")}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 12, left: -4, bottom: 0 }}>
              <defs>
                <linearGradient id="ccFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F0B429" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#F0B429" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="#E2DFD5" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { day: "numeric", month: "short" })} tick={{ fontSize: 12, fill: "#566676" }} axisLine={false} tickLine={false} minTickGap={36} tickMargin={10} />
              <YAxis domain={[lo - pad, hi + pad]} tickFormatter={formatINRCompact} tick={{ fontSize: 12, fill: "#566676" }} axisLine={false} tickLine={false} width={56} allowDataOverflow />
              <ReferenceArea y1={lo - pad} y2={c.buffer} fill="#B42318" fillOpacity={0.06} />
              <ReferenceLine y={c.buffer} stroke="#8F6200" strokeDasharray="5 4" label={{ value: `${t("cc.buffer")} ${formatINRCompact(c.buffer)}`, position: "insideTopRight", fill: "#8F6200", fontSize: 12, fontWeight: 700 }} />
              {lo < 0 && <ReferenceLine y={0} stroke="#B42318" />}
              <Tooltip content={<ChartTooltip formatDate={formatDate} t={t} />} cursor={{ stroke: "#CFCBBE" }} />
              <Area type="monotone" dataKey="balance" stroke="none" fill="url(#ccFill)" isAnimationActive animationDuration={600} />
              <Line type="monotone" dataKey="balance" stroke="#0B1B2B" strokeWidth={2.75} dot={<EventDot />} activeDot={{ r: 6, fill: "#0B1B2B", stroke: "#fff", strokeWidth: 2 }} isAnimationActive animationDuration={600} />
              <ReferenceDot x={c.lowest.date} y={c.lowest.balance} r={7} fill={tone === "safe" ? "#0F7B58" : "#B42318"} stroke="#fff" strokeWidth={3} ifOverflow="extendDomain" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-surface-border pt-4 text-sm">
          <div><dt className="text-xs font-semibold text-ink-muted">{t("cc.now")}</dt><dd className="num text-lg font-extrabold text-ink">{formatINR(c.current)}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-muted">{t("cc.lowest")}</dt><dd className={`num text-lg font-extrabold ${tone === "safe" ? "text-ink" : "text-loss"}`}>{formatINR(c.lowest.balance)}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-muted">{t("cc.buffer")}</dt><dd className="num text-lg font-extrabold text-ink">{formatINR(c.buffer)}</dd><p className="text-[11px] text-ink-muted">{t("cc.bufferHint", { n: c.buffer_days })}</p></div>
        </dl>
      </section>

      {crunch && c.rescue && (
        <section className="rounded-2xl bg-gold-500 p-5 text-ink shadow-card md:p-6">
          <div className="flex items-start gap-3">
            <LifeBuoy size={26} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold">{t("cc.rescue")}</h2>
              <p className="mt-0.5 text-[15px] font-semibold">{c.rescue.covers ? t("cc.rescueBody", { amount: formatINR(c.rescue.need) }) : t("cc.rescuePartial", { total: formatINR(c.rescue.total), need: formatINR(c.rescue.need) })}</p>
              <ul className="mt-4 divide-y divide-ink/15 rounded-xl bg-white/50">
                {c.rescue.items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-extrabold">{i.party}</span>
                      <span className="text-xs font-bold text-ink/70">{i.days_overdue ? t("ai.late", { n: i.days_overdue }) : t("cc.legendInvoice")}{i.label ? ` · ${t(`ud.label.${i.label}`)}` : ""}</span>
                    </span>
                    <span className="num text-lg font-extrabold">{formatINR(i.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => remind.mutate(c.rescue.items)} disabled={remind.isPending} className="btn-ink">{remind.isPending ? t("cc.reminding") : t("cc.remindAll", { n: c.rescue.items.length })}</button>
                <Link to="/receivables" className="btn-secondary border-ink/30 bg-white/60">{t("cc.openReceivables")}</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card p-5 md:p-6" aria-labelledby="stress-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="stress-title" className="text-lg font-extrabold text-ink">{t("cc.stress")}</h2>
            <p className="mt-0.5 text-[15px] text-ink-soft">{t("cc.stressSub")}</p>
          </div>
          <button onClick={() => setS(ZERO)} disabled={!s.sales && !s.costs} className="btn-secondary min-h-[40px] px-3 py-2"><RotateCcw size={15} /> {t("cc.reset")}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map(([key, p]) => (
            <button key={key} onClick={() => setS(p)} className="min-h-[40px] rounded-full border border-surface-strong bg-surface-card px-3.5 text-sm font-bold text-ink-soft hover:bg-gold-50 hover:text-ink">{t(key)}</button>
          ))}
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <Slider id="cc-sales" label={t("cc.sales")} value={s.sales} min={-100} max={50} onChange={(v) => setS((x) => ({ ...x, sales: v }))} />
          <Slider id="cc-costs" label={t("cc.costs")} value={s.costs} min={-30} max={150} onChange={(v) => setS((x) => ({ ...x, costs: v }))} />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <section className="card p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t("cc.bills")}</h2>
          {!bills.length ? <p className="mt-3 text-[15px] text-ink-soft">{t("cc.noBills")}</p> : (
            <ul className="mt-3 divide-y divide-surface-border">
              {bills.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0"><span className="block truncate text-[15px] font-bold text-ink">{b.party}</span>
                    <span className={`text-xs font-bold ${b.overdue ? "text-loss" : "text-ink-muted"}`}>{b.overdue ? t("cc.overdueTag") : formatDate(b.date, { day: "numeric", month: "short" })}</span></span>
                  <span className="num font-extrabold text-ink">{formatINR(b.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t("cc.collect")}</h2>
          {!owed.length ? <p className="mt-3 text-[15px] text-ink-soft">{t("cc.noInvoices")}</p> : (
            <ul className="mt-3 divide-y divide-surface-border">
              {owed.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0"><span className="block truncate text-[15px] font-bold text-ink">{o.party}</span>
                    <span className={`text-xs font-bold ${o.promised ? "text-info" : o.overdue ? "text-loss" : "text-ink-muted"}`}>
                      {o.promised ? t("cc.promisedTag", { date: formatDate(o.date, { day: "numeric", month: "short" }) }) : o.overdue ? t("cc.overdueTag") : t("cc.expectedTag", { date: formatDate(o.date, { day: "numeric", month: "short" }) })}
                    </span></span>
                  <span className="num font-extrabold text-gain">{formatINR(o.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="rounded-2xl bg-surface-muted p-4">
        <button onClick={() => setShowHow((v) => !v)} aria-expanded={showHow} className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-extrabold text-ink">
          {t("cc.how")} <ChevronDown size={16} className={`transition-transform ${showHow ? "rotate-180" : ""}`} />
        </button>
        {showHow && <p className="mt-1 text-sm leading-relaxed text-ink-soft animate-fade-up">{t("cc.howBody")}</p>}
      </div>
    </div>
  );
}
