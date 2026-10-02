import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Download, FileWarning, ReceiptText, WandSparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import api from "../lib/apiClient.js";
import { formatINR, formatINRCompact } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";

const RATES = [0, 5, 12, 18, 28];

function Deadline({ label, date, days }) {
  const { t, formatDate } = useI18n();
  const tone = days < 0 ? "bg-loss-soft text-loss" : days <= 3 ? "bg-loss-soft text-loss" : days <= 7 ? "bg-gold-100 text-gold-700" : "bg-gain-soft text-gain-ink";
  return (
    <div className={`rounded-xl px-4 py-3 ${tone}`}>
      <p className="flex items-center gap-1.5 text-sm font-extrabold"><CalendarClock size={16} /> {t(label, { date: formatDate(date, { day: "numeric", month: "short" }) })}</p>
      <p className="num mt-0.5 text-lg font-extrabold">{days < 0 ? t("gs.pastDue") : t("gs.daysLeft", { n: days })}</p>
    </div>
  );
}

export default function Gst() {
  const { t, formatDate } = useI18n();
  const [rate, setRate] = useState(() => Number(localStorage.getItem("dhan_gst_rate")) || 18);
  const [inclusive, setInclusive] = useState(() => localStorage.getItem("dhan_gst_incl") !== "0");
  const pick = (r) => { setRate(r); localStorage.setItem("dhan_gst_rate", String(r)); };
  const pickIncl = (v) => { setInclusive(v); localStorage.setItem("dhan_gst_incl", v ? "1" : "0"); };

  const query = useQuery({ queryKey: ["gst", rate, inclusive], queryFn: () => api.get("/gst/summary", { params: { months: 6, rate, inclusive } }).then((r) => r.data), placeholderData: (p) => p });
  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (query.isError) return <div className="card"><ErrorState onRetry={query.refetch} /></div>;
  const g = query.data;
  const f = g.filing;
  const period = g.months.find((m) => m.month === f.period);

  const exportPack = async () => {
    const reg = await api.get("/gst/register", { params: { month: f.period, rate, inclusive } }).then((r) => r.data);
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      `${esc("Return period")},${esc(reg.month)}`, `${esc("Sales (taxable value incl. GST if inclusive)")},${reg.sales}`, `${esc("Estimated output GST")},${reg.output_gst}`,
      `${esc("Estimated net payable")},${f.estimated_net_payable}`, `${esc("Note")},${esc("Estimates from DHAN. Verify with your CA before filing.")}`, "",
      ["Date", "Supplier", "GSTIN", "Category", "Amount", "ITC estimate"].map(esc).join(","),
      ...reg.purchases.map((p) => [p.date, p.vendor, p.gstin, p.category, p.amount, p.itc_estimate].map(esc).join(",")),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `dhan-gst-pack-${reg.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!g.totals.sales && !g.totals.itc) {
    return <div className="max-w-xl space-y-5"><PageHeader title={t("gs.title")} /><div className="card"><EmptyState icon={ReceiptText} title={t("gs.title")} body={t("gs.insufficient")} /></div></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={t("gs.title")}
        subtitle={t("gs.sub")}
        action={<Link to={`/ask?q=${encodeURIComponent(t("gs.askAi"))}`} className="btn-secondary"><WandSparkles size={16} /> {t("gs.askAi")}</Link>}
      />
      <p className="rounded-xl bg-gold-50 px-4 py-3 text-sm font-semibold text-gold-700">{t("gs.banner")}</p>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5 md:p-6">
          <p className="text-sm font-semibold text-ink-muted">{t("gs.period", { period: f.period })}</p>
          <h2 className="mt-1 text-[15px] font-bold text-ink-soft">{t("gs.net")}</h2>
          <p className="num text-[44px] font-extrabold leading-none text-ink md:text-[52px]">{formatINR(f.estimated_net_payable ?? 0)}</p>
          {period && (
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-surface-border pt-4 text-sm">
              <div><dt className="text-xs font-semibold text-ink-muted">{t("gs.output")}</dt><dd className="num text-lg font-extrabold text-ink">{formatINR(period.output_gst)}</dd></div>
              <div><dt className="text-xs font-semibold text-ink-muted">{t("gs.itc")}</dt><dd className="num text-lg font-extrabold text-gain">−{formatINR(period.itc)}</dd></div>
              <div><dt className="text-xs font-semibold text-ink-muted">{t("gs.paid")}</dt><dd className="num text-lg font-extrabold text-ink">{formatINR(f.paid_so_far)}</dd></div>
            </dl>
          )}
        </div>
        <div className="grid gap-3 content-start">
          <Deadline label="gs.gstr1" date={f.gstr1_due} days={f.days_to_gstr1} />
          <Deadline label="gs.gstr3b" date={f.gstr3b_due} days={f.days_to_gstr3b} />
          <button onClick={exportPack} className="btn-secondary"><Download size={17} /> {t("gs.export")}</button>
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-ink">{t("gs.trend")}</h2>
          <ul className="flex gap-4 text-sm font-semibold text-ink-soft">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink" /> {t("gs.legendOut")}</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold-500" /> {t("gs.legendIn")}</li>
          </ul>
        </div>
        <div className="mt-4 h-64" role="img" aria-label={t("gs.trend")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={g.months.map((m) => ({ ...m, label: formatDate(m.month + "-01", { month: "short" }) }))} margin={{ top: 6, right: 6, left: -4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="#E2DFD5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#566676" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatINRCompact} tick={{ fontSize: 12, fill: "#566676" }} axisLine={false} tickLine={false} width={52} />
              <Tooltip formatter={(v) => formatINR(v)} cursor={{ fill: "#F5F4EF" }} />
              <Bar dataKey="output_gst" name={t("gs.legendOut")} fill="#0B1B2B" radius={[5, 5, 0, 0]} />
              <Bar dataKey="itc" name={t("gs.legendIn")} fill="#F0B429" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-bold text-ink-muted">
              {["gs.month", "gs.sales", "gs.output", "gs.itc", "gs.netCol", "gs.paid"].map((k, i) => <th key={k} scope="col" className={`pb-2 pr-3 ${i ? "text-right" : ""}`}>{t(k)}</th>)}
            </tr></thead>
            <tbody>
              {g.months.map((m) => (
                <tr key={m.month} className={`border-t border-surface-border ${m.month === f.period ? "bg-gold-50" : ""}`}>
                  <td className="py-2 pr-3 font-bold text-ink">{formatDate(m.month + "-01", { month: "short", year: "2-digit" })}</td>
                  <td className="num py-2 pr-3 text-right text-ink-soft">{formatINR(m.sales)}</td>
                  <td className="num py-2 pr-3 text-right text-ink-soft">{formatINR(m.output_gst)}</td>
                  <td className="num py-2 pr-3 text-right text-ink-soft">{formatINR(m.itc)}</td>
                  <td className="num py-2 pr-3 text-right font-extrabold text-ink">{formatINR(m.net_payable)}</td>
                  <td className="num py-2 text-right text-ink-soft">{m.paid ? formatINR(m.paid) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><FileWarning size={20} /></span>
          <div>
            <h2 className="text-lg font-extrabold text-ink">{t("gs.left")}</h2>
            <p className="mt-0.5 text-[15px] text-ink-soft">{g.missing_invoices.length ? t("gs.leftBody") : t("gs.noMissing")}</p>
          </div>
          {g.totals.itc_missing > 0 && <p className="num ml-auto shrink-0 text-2xl font-extrabold text-gain">{formatINR(g.totals.itc_missing)}</p>}
        </div>
        {!!g.missing_invoices.length && (
          <ul className="mt-4 divide-y divide-surface-border">
            {g.missing_invoices.map((m) => (
              <li key={m.vendor} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0"><span className="block truncate text-[15px] font-bold text-ink">{m.vendor}</span><span className="text-xs text-ink-muted">{t("gs.bills", { n: m.count })} · {formatINR(m.amount)}</span></span>
                <span className="chip bg-gain-soft px-2.5 py-1 text-gain-ink">{t("gs.potential", { amount: formatINR(m.itc_potential) })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="gst-assume">
        <h2 id="gst-assume" className="text-lg font-extrabold text-ink">{t("gs.assumptions")}</h2>
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          <div>
            <p className="field-label">{t("gs.rate")}</p>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {RATES.map((r) => (
                <button key={r} role="radio" aria-checked={rate === r} onClick={() => pick(r)} className={`min-h-[42px] rounded-xl border px-4 text-sm font-extrabold ${rate === r ? "border-ink bg-ink text-white" : "border-surface-strong text-ink-soft hover:bg-surface-muted"}`}>{r}%</button>
              ))}
            </div>
          </div>
          <div>
            <p className="field-label">{t("gs.inclusive")}</p>
            <div role="radiogroup" className="inline-flex rounded-xl bg-surface-muted p-1">
              {[[true, t("gs.inclusive")], [false, t("gs.exclusive")]].map(([v, label]) => (
                <button key={String(v)} role="radio" aria-checked={inclusive === v} onClick={() => pickIncl(v)} className={`min-h-[40px] rounded-lg px-3 text-sm font-bold ${inclusive === v ? "bg-surface-card text-ink shadow-subtle" : "text-ink-soft"}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-muted">{t("gs.note")}</p>
      </section>
    </div>
  );
}
