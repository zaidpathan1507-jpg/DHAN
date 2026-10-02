import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import CreditComponents from "../components/credit/CreditComponents.jsx";
import CreditGauge, { BAND_CHIP } from "../components/credit/CreditGauge.jsx";
import LanguageToggle from "../components/common/LanguageToggle.jsx";
import Logo from "../components/common/Logo.jsx";
import api from "../lib/apiClient.js";
import { formatINR } from "../lib/constants.js";
import { emi } from "../lib/finance.js";
import { useI18n } from "../lib/i18n.jsx";

// Demo: the lender's side of a loan application. Acting here makes the borrower's alert arrive live in the other window.
export default function LenderDesk() {
  const { token } = useParams();
  const { t, tr } = useI18n();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("approve");
  const [counter, setCounter] = useState({ amount: "", rate: "" });
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const query = useQuery({ queryKey: ["lender", token], queryFn: () => api.get(`/public/lender/${token}`).then((r) => r.data), retry: false, refetchInterval: 6000 });
  const decide = useMutation({
    mutationFn: () =>
      api.post(`/public/lender/${token}/decision`, {
        decision: mode,
        amount: mode === "counter" && counter.amount ? Number(counter.amount) : undefined,
        rate: mode === "counter" && counter.rate ? Number(counter.rate) : undefined,
        reason: mode === "decline" ? reason || undefined : undefined,
      }),
    onSuccess: () => {
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ["lender", token] });
    },
  });

  const shell = (children) => (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-surface-border bg-surface-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3"><Logo size={32} /><LanguageToggle /></div>
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">{children}</main>
    </div>
  );

  if (query.isLoading) return shell(<div className="h-72 animate-pulse rounded-2xl bg-surface-muted" />);
  if (query.isError) return shell(<div className="card px-6 py-14 text-center"><h1 className="text-2xl font-extrabold text-ink">{t("pub.invalid")}</h1></div>);

  const { application: a, borrower: b } = query.data;
  const c = b.credit;
  const closed = ["accepted", "withdrawn"].includes(a.status);

  return shell(
    <>
      <p className="flex items-start gap-2 rounded-xl bg-info-soft px-4 py-3 text-sm font-semibold text-info"><Sparkles size={16} className="mt-0.5 shrink-0" /> {t("ld.demoBanner")}</p>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("ld.title")}</h1>
        <p className="mt-1 text-[15px] text-ink-soft">{t("ld.sub", { lender: a.lender_name })}</p>
      </div>

      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t("ld.application")} · {b.business.name}</h2>
        <p className="text-sm text-ink-muted">{tr("biz", b.business.type)} · {b.business.city}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-4">
          <div><dt className="text-sm font-semibold text-ink-muted">{t("ld.requested")}</dt><dd className="num text-xl font-extrabold text-ink">{formatINR(a.amount)}</dd></div>
          <div><dt className="text-sm font-semibold text-ink-muted">{t("ln.tenure")}</dt><dd className="num text-xl font-extrabold text-ink">{t("ln.tenureMonths", { n: a.tenure })}</dd></div>
          <div><dt className="text-sm font-semibold text-ink-muted">{t("ln.rate", { rate: a.rate })}</dt><dd className="num text-xl font-extrabold text-ink">{a.rate}%</dd></div>
          <div><dt className="text-sm font-semibold text-ink-muted">EMI</dt><dd className="num text-xl font-extrabold text-ink">{formatINR(a.emi)}</dd></div>
        </dl>
      </section>

      <section className="card flex flex-col items-center gap-6 p-6 sm:flex-row">
        {!c.insufficient_history && (
          <>
            <CreditGauge score={c.score} band={c.band} width={210} />
            <div className="w-full">
              <span className={`chip px-3 py-1 text-sm ${BAND_CHIP[c.band]}`}>{t(`band.${c.band}`)}</span>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs font-semibold text-ink-muted">{t("pub.avgMonthly")}</dt><dd className="num font-extrabold text-ink">{formatINR(b.last_90_days.avg_monthly_income)}</dd></div>
                <div><dt className="text-xs font-semibold text-ink-muted">{t("common.net")}</dt><dd className={`num font-extrabold ${b.last_90_days.net >= 0 ? "text-gain" : "text-loss"}`}>{formatINR(b.last_90_days.net)}</dd></div>
                <div><dt className="text-xs font-semibold text-ink-muted">{t("pub.records", { n: b.months_of_records })}</dt><dd className="font-extrabold text-ink">{b.months_of_records}</dd></div>
                <div><dt className="text-xs font-semibold text-ink-muted">{t("pub.outlook")}</dt><dd className="font-extrabold text-ink">{b.forecast_status ? t(`status.${b.forecast_status}`) : "—"}</dd></div>
              </dl>
            </div>
          </>
        )}
      </section>

      {!c.insufficient_history && <section className="card p-5 md:p-6"><CreditComponents components={c.components} /></section>}

      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t("ld.decision")}</h2>
        {sent || ["approved", "declined", "accepted"].includes(a.status) ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-gain-soft px-4 py-3 text-[15px] font-bold text-gain-ink">
            <CheckCircle2 size={18} /> {sent ? t("ld.sent") : `${t("ld.status")}: ${t(`ln.stage.${a.status}`)}`}
          </p>
        ) : null}
        {!closed && (
          <>
            <div role="radiogroup" className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-surface-muted p-1">
              {[["approve", t("ld.approve")], ["counter", t("ld.counter")], ["decline", t("ld.decline")]].map(([k, label]) => (
                <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`min-h-[44px] rounded-lg px-2 text-sm font-extrabold ${mode === k ? "bg-surface-card text-ink shadow-subtle" : "text-ink-soft"}`}>{label}</button>
              ))}
            </div>
            {mode === "counter" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="ca" className="field-label">{t("ld.counterAmount")}</label><input id="ca" type="number" className="field num" value={counter.amount} onChange={(e) => setCounter((x) => ({ ...x, amount: e.target.value }))} placeholder={String(a.amount)} /></div>
                <div><label htmlFor="cr" className="field-label">{t("ld.counterRate")}</label><input id="cr" type="number" step="0.1" className="field num" value={counter.rate} onChange={(e) => setCounter((x) => ({ ...x, rate: e.target.value }))} placeholder={String(a.rate)} /></div>
                {counter.amount && counter.rate && <p className="num text-sm font-bold text-ink-soft sm:col-span-2">EMI ≈ {formatINR(emi(Number(counter.amount), Number(counter.rate), a.tenure))}</p>}
              </div>
            )}
            {mode === "decline" && <div className="mt-4"><label htmlFor="rs" className="field-label">{t("ld.reason")}</label><input id="rs" className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
            <button onClick={() => decide.mutate()} disabled={decide.isPending} className="btn-primary mt-5 w-full">{t("ld.send")}</button>
          </>
        )}
      </section>
    </>
  );
}
