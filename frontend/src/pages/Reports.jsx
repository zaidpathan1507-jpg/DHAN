import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, Printer } from "lucide-react";
import { useState } from "react";

import DhanAiMark from "../components/ai/DhanAiMark.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import Modal from "../components/common/Modal.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import { useToast } from "../components/common/Toast.jsx";
import api from "../lib/apiClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { formatINR, formatPct } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";

function Section({ title, children }) {
  return (
    <section className="break-inside-avoid border-t border-surface-border pt-5">
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Reports() {
  const { t, tr, lang, formatDate } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [emailOpen, setEmailOpen] = useState(false);
  const [to, setTo] = useState(user?.report_email || "");
  const query = useQuery({ queryKey: ["weekly-report", lang], queryFn: () => api.get("/reports/weekly", { params: { lang } }).then((r) => r.data) });
  const send = useMutation({
    mutationFn: () => api.post("/reports/weekly/email", { to: to || undefined, lang }).then((r) => r.data),
    onSuccess: (r) => {
      showToast(r.status === "failed" ? t("rp.fail") : t("rp.sent", { to: r.to }), r.status === "failed" ? "error" : "success");
      setEmailOpen(false);
    },
    onError: () => showToast(t("rp.fail"), "error"),
  });

  if (query.isLoading) return <Skeleton className="h-[40rem] w-full rounded-2xl" />;
  if (query.isError) return <div className="card"><ErrorState onRetry={query.refetch} /></div>;
  const r = query.data;
  const m = r.metrics;
  const d = (iso) => formatDate(iso, { day: "numeric", month: "short" });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-[32px]">{t("rp.title")}</h1>
          <p className="mt-1 text-[15px] text-ink-soft">{t("rp.sub")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEmailOpen(true)} className="btn-secondary"><Mail size={17} /> {t("rp.email")}</button>
          <button onClick={() => window.print()} className="btn-primary"><Printer size={17} /> {t("rp.print")}</button>
        </div>
      </div>

      <article className="card space-y-5 p-6 md:p-9 print:border-0 print:shadow-none">
        <header>
          <p className="text-sm font-bold text-ink-muted">{r.business} · {t("rp.week", { from: d(r.from), to: d(r.to) })}</p>
          <h2 className="mt-1 text-[28px] font-extrabold tracking-tight text-ink">{t("rp.title")}</h2>
        </header>

        <div className="rounded-2xl bg-gold-50 p-5">
          <p className="flex items-center gap-2 text-sm font-extrabold text-gold-700"><DhanAiMark size={26} /> {t("rp.noteFrom")} <span className="ml-1 font-semibold text-ink-muted">· {t(r.mode === "groq" ? "rp.groq" : "rp.rules")}</span></p>
          <p className="mt-2 text-[16px] leading-relaxed text-ink">{r.note}</p>
        </div>

        <Section title={t("rp.numbers")}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[["rp.income", m.income, "text-gain", m.income_change_pct_vs_previous], ["rp.expenses", m.expenses, "text-ink", m.expenses_change_pct_vs_previous], ["rp.net", m.net, m.net >= 0 ? "text-gain" : "text-loss"], ["rp.cash", m.cash_balance_now, "text-ink"]].map(([k, v, tone, ch]) => (
              <div key={k}>
                <dt className="text-sm font-semibold text-ink-muted">{t(k)}</dt>
                <dd className={`num text-2xl font-extrabold ${tone}`}>{formatINR(v)}</dd>
                {ch != null && <p className="text-xs font-bold text-ink-muted">{formatPct(ch)}</p>}
              </div>
            ))}
          </dl>
        </Section>

        {!!r.focus.length && (
          <Section title={t("rp.focus")}>
            <ol className="space-y-2">
              {r.focus.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] text-ink"><span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-extrabold text-white">{i + 1}</span> {f}</li>
              ))}
            </ol>
          </Section>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title={t("rp.spend")}>
            <ul className="space-y-2">
              {r.categories.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between text-sm"><span className="truncate font-bold text-ink">{tr("cat", c.category)}</span><span className="num font-extrabold text-ink">{formatINR(c.amount)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.max(3, c.share_pct)}%` }} /></div>
                </li>
              ))}
            </ul>
          </Section>
          <Section title={t("rp.vendors")}>
            <ul className="space-y-2 text-sm">
              {r.vendors.map((v) => <li key={v.vendor} className="flex justify-between gap-3"><span className="truncate font-bold text-ink">{v.vendor}</span><span className="num shrink-0 font-extrabold text-ink">{formatINR(v.amount)}</span></li>)}
            </ul>
          </Section>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title={t("rp.owed")}>
            <p className="num text-2xl font-extrabold text-gain">{formatINR(r.receivables.total)}</p>
            <p className={`text-sm font-bold ${r.receivables.overdue ? "text-loss" : "text-ink-muted"}`}>{t("rp.overdue", { amount: formatINR(r.receivables.overdue) })}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {r.receivables.top.map((x) => <li key={x.party} className="flex justify-between gap-3"><span className="truncate text-ink-soft">{x.party}</span><span className="num font-bold text-ink">{formatINR(x.outstanding)}</span></li>)}
            </ul>
          </Section>
          <Section title={t("rp.outlook")}>
            <p className="text-[15px] font-bold text-ink">{r.cash.crunch ? t("rp.tight", { date: d(r.cash.crunch.date) }) : t("rp.safe")}</p>
            {r.cash.lowest_balance != null && <p className="num mt-1 text-sm text-ink-soft">{formatINR(r.cash.lowest_balance)} · {d(r.cash.lowest_on)}</p>}
            <p className="mt-3 text-sm font-bold text-ink">{t("rp.gst")}: GSTR-3B {d(r.gst.gstr3b_due)} · {formatINR(r.gst.estimated_net_payable ?? 0)}</p>
          </Section>
        </div>

        {r.recovered.amount > 0 && (
          <p className="rounded-xl bg-gain-soft px-4 py-3 text-[15px] font-extrabold text-gain-ink">{t("rp.recovered")}: {formatINR(r.recovered.amount)}</p>
        )}

        {!!r.insights.length && (
          <Section title={t("rp.insights")}>
            <ul className="space-y-2 text-sm text-ink-soft">{r.insights.map((i, k) => <li key={k}><span className="font-bold text-ink">{i.title.charAt(0) + i.title.slice(1).toLowerCase()} {i.headline}.</span> {i.body}</li>)}</ul>
          </Section>
        )}
        <p className="border-t border-surface-border pt-4 text-xs text-ink-muted">{t("rp.footer")}</p>
      </article>

      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title={t("rp.email")}>
        <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="space-y-4">
          <div><label htmlFor="rp-to" className="field-label">{t("rp.emailTo")}</label><input id="rp-to" type="email" required className="field" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@company.com" /></div>
          <p className="text-sm text-ink-muted">{t("rp.simulated")}</p>
          <button type="submit" disabled={send.isPending} className="btn-primary w-full">{send.isPending ? t("rp.sending") : t("rp.send")}</button>
        </form>
      </Modal>
    </div>
  );
}
