import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, Lightbulb, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import api from "../lib/apiClient.js";
import { formatINR, formatINRCompact } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";

const MONEY = new Set(["amount", "old", "new", "monthly", "gain", "last30", "usual", "cash", "profit", "set_aside", "excess", "impact", "total_open"]);
const PRIORITY_TONE = { high: "bg-loss-soft text-loss", medium: "bg-gold-100 text-gold-700", low: "bg-surface-muted text-ink-soft" };
const HEALTH_TONE = { strong: "text-gain", steady: "text-gold-500", needs_work: "text-loss" };
const GO = { collect: "/receivables", itc: "/gst", runway: "/cash-calendar", tax_aside: "/gst" };

function Ring({ score, label }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`${score}/100`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="#F0B429" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-4xl font-extrabold leading-none">{score}</span>
        <span className="mt-1 text-xs font-bold text-white/70">{label}</span>
      </div>
    </div>
  );
}

function Recommendation({ rec, checked, onToggle }) {
  const { t, tr, formatDate } = useI18n();
  const vars = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries({ ...rec.params, impact: rec.impact })) {
      out[k] = MONEY.has(k) ? formatINR(v) : k === "category" ? tr("cat", v) : k === "date" ? formatDate(v, { day: "numeric", month: "short" }) : v;
    }
    return out;
  }, [rec, tr, formatDate]);
  const steps = ["s1", "s2", "s3"].filter((s) => t(`adv.${rec.code}.${s}`) !== `adv.${rec.code}.${s}`);
  const go = GO[rec.code];

  return (
    <li className={`rounded-2xl border bg-surface-card p-4 shadow-subtle transition-colors md:p-5 ${checked ? "border-gold-500 ring-2 ring-gold-500/60" : "border-surface-border"}`}>
      <div className="flex items-start gap-3">
        <button role="checkbox" aria-checked={checked} aria-label={t(`adv.${rec.code}.title`, vars)} onClick={onToggle}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${checked ? "border-gold-500 bg-gold-500 text-ink" : "border-surface-strong text-transparent hover:border-ink-muted"}`}>
          <Check size={16} strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip px-2 py-0.5 ${PRIORITY_TONE[rec.priority]}`}>{t(`adv.p.${rec.priority}`)}</span>
            <span className="chip bg-surface-muted px-2 py-0.5 text-ink-soft">{t(`adv.a.${rec.area}`)}</span>
          </div>
          <h3 className="mt-2 text-[17px] font-extrabold leading-snug text-ink">{t(`adv.${rec.code}.title`, vars)}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{t(`adv.${rec.code}.why`, vars)}</p>
          <p className="mt-3 text-xs font-bold text-ink-muted">{t("adv.steps")}</p>
          <ol className="mt-1.5 space-y-1.5">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-2.5 text-sm text-ink">
                <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-extrabold text-ink-soft">{i + 1}</span>
                <span>{t(`adv.${rec.code}.${s}`, vars)}</span>
              </li>
            ))}
          </ol>
          {go && <Link to={go} className="link mt-3 inline-block text-sm">{t(`adv.go.${rec.code}`)}</Link>}
        </div>
        <p className={`num shrink-0 text-right text-[15px] font-extrabold ${rec.impact ? "text-gain" : "text-ink-muted"}`}>{rec.impact ? t("adv.perMonth", { amount: formatINR(rec.impact) }) : t("adv.protects")}</p>
      </div>
    </li>
  );
}

export default function Advisor() {
  const { t, tr, lang, formatDate } = useI18n();
  const query = useQuery({ queryKey: ["advisor"], queryFn: () => api.get("/advisor").then((r) => r.data), staleTime: 60000 });
  const note = useQuery({ queryKey: ["advisor-note", lang], queryFn: () => api.get("/advisor/note", { params: { lang } }).then((r) => r.data), staleTime: 300000, enabled: query.data?.insufficient === false });
  const [picked, setPicked] = useState(() => new Set());

  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (query.isError) return <div className="card"><ErrorState onRetry={query.refetch} /></div>;
  const a = query.data;
  if (a.insufficient) return <div className="max-w-xl space-y-5"><PageHeader title={t("adv.title")} /><div className="card"><EmptyState icon={Lightbulb} title={t("adv.insufficient")} body={t("adv.insufficientBody")} /></div></div>;

  const { pnl, recommendations: recs } = a;
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sel = recs.filter((r) => picked.has(r.id));
  const selGain = sel.reduce((s, r) => s + (r.impact || 0), 0);
  const marginAfter = (g) => Math.round(((pnl.profit_monthly + g) / pnl.revenue_monthly) * 1000) / 10;
  const withImpact = recs.filter((r) => r.impact).length;
  const noteVars = { profit: formatINR(pnl.profit), revenue: formatINR(pnl.revenue), margin: pnl.margin, gain: formatINR(a.potential_monthly) };
  const be = a.break_even;
  const chart = a.months.map((m) => ({ ...m, label: formatDate(m.month + "-01", { month: "short" }) }));

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("adv.title")} subtitle={t("adv.sub")} action={<Link to={`/ask?q=${encodeURIComponent(t("adv.ask"))}`} className="btn-secondary"><WandSparkles size={16} /> {t("adv.ask")}</Link>} />

      <section className="rounded-2xl bg-ink p-5 text-white shadow-hero md:p-7" aria-label={t("adv.health")}>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0 max-w-xl">
            <h2 className="text-2xl font-extrabold leading-tight md:text-[30px]">{a.potential_monthly > 0 ? t("adv.hero", { amount: formatINR(a.potential_monthly) }) : t("adv.heroNone")}</h2>
            <p className="mt-2 text-[15px] text-white/70">{a.potential_monthly > 0 ? t("adv.heroSub", { n: withImpact }) : t("adv.heroNoneSub")}</p>
            <dl className="mt-5 grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-3.5">
                <dt className="text-xs font-semibold text-white/70">{t("adv.profitNow")}</dt>
                <dd className="num mt-0.5 text-xl font-extrabold">{formatINR(pnl.profit_monthly)}</dd>
                <dd className="text-xs font-semibold text-white/60">{t("adv.margin")} {pnl.margin}%</dd>
              </div>
              <div className="rounded-xl bg-gold-500 p-3.5 text-ink">
                <dt className="text-xs font-bold text-ink/70">{t("adv.profitAfter")}</dt>
                <dd className="num mt-0.5 text-xl font-extrabold">{formatINR(pnl.profit_monthly + a.potential_monthly)}</dd>
                <dd className="text-xs font-bold text-ink/70">{t("adv.margin")} {marginAfter(a.potential_monthly)}%</dd>
              </div>
            </dl>
          </div>
          <Ring score={a.health.score} label={t(`adv.h.${a.health.label}`)} />
        </div>
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="adv-note">
        <h2 id="adv-note" className="flex items-center gap-2 text-base font-extrabold text-ink"><Lightbulb size={18} className="text-gold-700" /> {t("adv.note")}</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-ink">{note.data?.text || (a.potential_monthly > 0 ? t("adv.noteAuto", noteVars) : t("adv.noteAutoNone", noteVars))}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5 md:p-6">
          <h2 className="text-base font-extrabold text-ink">{t("adv.pnl")}</h2>
          <div className="mt-3 h-64" role="img" aria-label={t("adv.pnl")}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 6, right: 6, left: -4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 4" stroke="#E2DFD5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#566676" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatINRCompact} tick={{ fontSize: 12, fill: "#566676" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v) => formatINR(v)} cursor={{ fill: "#F5F4EF" }} />
                <Bar dataKey="revenue" name={t("adv.revenue")} fill="#0B1B2B" radius={[5, 5, 0, 0]} />
                <Bar dataKey="expenses" name={t("adv.expenses")} fill="#F0B429" radius={[5, 5, 0, 0]} />
                <Line dataKey="profit" name={t("adv.profit")} stroke="#0F7B58" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-ink-soft">
            {[["bg-ink", "adv.revenue"], ["bg-gold-500", "adv.expenses"], ["bg-gain", "adv.profit"]].map(([c, k]) => <span key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${c}`} />{t(k)}</span>)}
          </div>
        </section>

        <section className="card p-5 md:p-6">
          <h2 className="text-base font-extrabold text-ink">{t("adv.cost")}</h2>
          <p className="text-sm text-ink-soft">{t("adv.costSub")}</p>
          <ul className="mt-4 space-y-3.5">
            {a.structure.slice(0, 7).map((s) => {
              const max = Math.max(s.share_of_revenue, s.benchmark || 0, 1) * 1.15;
              return (
                <li key={s.category}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-bold text-ink">{tr("cat", s.category)}</span>
                    <span className="num font-extrabold text-ink">{formatINR(s.amount)} <span className="text-xs font-semibold text-ink-muted">· {s.share_of_revenue}% {t("adv.of")}</span></span>
                  </div>
                  <div className="relative mt-1.5 h-2.5 rounded-full bg-surface-muted">
                    <div className={`h-full rounded-full ${s.status === "over" ? "bg-loss" : "bg-ink"}`} style={{ width: `${(s.share_of_revenue / max) * 100}%` }} />
                    {s.benchmark != null && <span className="absolute -top-1 h-4.5 w-0.5 bg-gold-700" style={{ left: `${(s.benchmark / max) * 100}%`, height: 18 }} title={t("adv.usual", { n: s.benchmark })} />}
                  </div>
                  {s.benchmark != null && <p className={`mt-1 text-xs font-semibold ${s.status === "over" ? "text-loss" : "text-ink-muted"}`}>{t(`adv.${s.status}`)} · {t("adv.usual", { n: s.benchmark })}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section aria-labelledby="adv-plan">
        <h2 id="adv-plan" className="text-xl font-extrabold text-ink">{t("adv.plan")}</h2>
        <p className="text-sm text-ink-soft">{t("adv.planSub")}</p>
        <ul className="mt-4 space-y-3">{recs.map((r) => <Recommendation key={r.id} rec={r} checked={picked.has(r.id)} onToggle={() => toggle(r.id)} />)}</ul>
        <div className="sticky bottom-20 z-10 mt-4 rounded-2xl bg-ink px-5 py-3.5 text-[15px] font-bold text-white shadow-elevated md:bottom-4" role="status" aria-live="polite">
          {sel.length ? t("adv.selected", { n: sel.length, amount: formatINR(selGain), from: pnl.margin, to: marginAfter(selGain) }) : t("adv.selectNone")}
        </div>
        <p className="mt-3 text-xs text-ink-muted">{t("adv.assume", { neg: a.assumptions.negotiate_pct, carry: a.assumptions.carry_rate_pct, churn: a.assumptions.churn_kept_pct })}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="text-base font-extrabold text-ink">{t("adv.health")}</h2>
          <ul className="mt-3 space-y-3">
            {a.health.factors.map((f) => (
              <li key={f.key}>
                <div className="flex justify-between text-sm"><span className="font-bold text-ink">{t(`adv.f.${f.key}`)}</span><span className={`num font-extrabold ${f.score >= 14 ? "text-gain" : f.score >= 8 ? "text-gold-700" : "text-loss"}`}>{f.score}/20</span></div>
                <div className="mt-1 h-2 rounded-full bg-surface-muted"><div className={`h-full rounded-full ${f.score >= 14 ? "bg-gain" : f.score >= 8 ? "bg-gold-500" : "bg-loss"}`} style={{ width: `${f.score * 5}%` }} /></div>
                <p className="mt-1 text-xs text-ink-muted">{f.value == null ? t("adv.fv.none") : t(`adv.fv.${f.key}`, { v: f.value })}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="text-base font-extrabold text-ink">{t("adv.breakeven")}</h2>
          <p className="text-sm text-ink-soft">{t("adv.beSub")}</p>
          {be.revenue_needed ? (
            <>
              <p className="num mt-3 text-[28px] font-extrabold leading-none text-ink">{t("adv.beNeeded", { amount: formatINR(be.revenue_needed) })}</p>
              <p className={`mt-2 text-sm font-bold ${be.cushion_pct >= 0 ? "text-gain" : "text-loss"}`}>{be.cushion_pct >= 0 ? t("adv.beAbove", { amount: formatINR(pnl.revenue_monthly), pct: be.cushion_pct }) : t("adv.beBelow", { amount: formatINR(pnl.revenue_monthly) })}</p>
            </>
          ) : <p className="mt-3 text-sm text-ink-soft">{t("adv.beNone")}</p>}
        </section>

        <section className="card p-5">
          <h2 className="text-base font-extrabold text-ink">{t("adv.calendar")}</h2>
          <ul className="mt-3 space-y-2.5">
            {a.calendar.map((c) => (
              <li key={c.code} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${c.days <= 3 ? "bg-loss-soft" : c.days <= 7 ? "bg-gold-50" : "bg-surface"}`}>
                <CalendarClock size={17} className="shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1 text-sm font-bold text-ink">{t(`adv.cal.${c.code}`)}</span>
                <span className="text-right text-xs font-bold text-ink-soft">{formatDate(c.date, { day: "numeric", month: "short" })}<br />{c.days === 0 ? t("adv.today") : t("adv.inDays", { n: c.days })}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">{t("adv.calNote")}</p>
        </section>
      </div>

      <p className="rounded-xl bg-gold-50 px-4 py-3 text-sm font-semibold text-gold-700">{t("adv.disclaimer")}</p>
    </div>
  );
}
