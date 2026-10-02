import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, CreditCard, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import LanguageToggle from "../components/common/LanguageToggle.jsx";
import { LogoMark } from "../components/common/Logo.jsx";
import api from "../lib/apiClient.js";
import { formatINR } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";

const todayStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4 + n * 864e5).toISOString().slice(0, 10);

function Card({ title, body, children }) {
  return (
    <section className="rounded-2xl border border-surface-border bg-surface-card p-5 shadow-subtle">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      {body && <p className="mt-0.5 text-[15px] text-ink-soft">{body}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Customer-facing page. No login: the unguessable link is the credential. Mobile-first.
export default function PayPage() {
  const { token } = useParams();
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const [refNo, setRefNo] = useState("");
  const [promiseDate, setPromiseDate] = useState(plusDays(3));
  const [message, setMessage] = useState("");
  const [done, setDone] = useState({});
  const [copied, setCopied] = useState(false);

  const query = useQuery({ queryKey: ["pay", token], queryFn: () => api.get(`/public/udhaar/${token}`).then((r) => r.data), retry: false, refetchInterval: 15000 });
  const post = (path, body, key) => useMutation({ // eslint-disable-line react-hooks/rules-of-hooks
    mutationFn: () => api.post(`/public/udhaar/${token}/${path}`, body()),
    onSuccess: () => {
      setDone((d) => ({ ...d, [key]: true }));
      queryClient.invalidateQueries({ queryKey: ["pay", token] });
    },
  });
  const claim = post("claim", () => ({ reference: refNo || null }), "claim");
  const promise = post("promise", () => ({ date: promiseDate }), "promise");
  const note = post("note", () => ({ text: message }), "note");

  const shell = (children) => (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-surface-border bg-surface-card">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-ink-soft">
            <LogoMark size={26} /> {t("pay.secure")}
          </span>
          <LanguageToggle />
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-12">{children}</main>
    </div>
  );

  if (query.isLoading) return shell(<div className="h-64 animate-pulse rounded-2xl bg-surface-muted" />);
  if (query.isError)
    return shell(
      <div className="rounded-2xl border border-surface-border bg-surface-card px-6 py-14 text-center">
        <h1 className="text-2xl font-extrabold text-ink">{t("pay.invalid")}</h1>
        <p className="mt-2 text-ink-soft">{t("pay.invalidBody")}</p>
      </div>
    );

  const d = query.data;
  const b = d.business.name;
  const dueText = d.paid ? null : d.days_overdue > 0 ? t("pay.overdue", { n: d.days_overdue }) : (() => {
    const days = Math.round((new Date(d.due_date) - new Date(todayStr())) / 864e5);
    return days <= 0 ? t("pay.dueToday") : t("pay.dueIn", { n: days });
  })();

  return shell(
    <>
      <section className="overflow-hidden rounded-2xl bg-ink text-white shadow-hero">
        <div className="p-6">
          <p className="text-[15px] font-semibold text-white/80">{t("pay.hello", { party: d.party })}</p>
          <p className="mt-1 text-sm text-white/70">{t("pay.requests", { business: b })}</p>
          <p className="num mt-3 text-[48px] font-extrabold leading-none tracking-tight">{formatINR(d.paid ? d.amount : d.outstanding)}</p>
          {d.note && <p className="mt-2 text-sm text-white/80">{t("pay.forNote", { note: d.note })}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {dueText ? (
              <span className={`chip ${d.days_overdue > 0 ? "bg-[#FFD9D4] text-loss" : "bg-white/15 text-white"}`}>{dueText}</span>
            ) : (
              <span className="chip bg-[#CFF1E1] text-gain-ink"><CheckCircle2 size={14} /> {t("pay.paidTitle")}</span>
            )}
            <span className="text-sm text-white/70">{t("pay.due", { date: formatDate(d.due_date, { day: "numeric", month: "short", year: "numeric" }) })}</span>
          </div>
        </div>
        {d.paid_amount > 0 && !d.paid && (
          <div className="border-t border-white/15 bg-ink-deep/40 px-6 py-3 text-sm text-white/85">
            {t("pay.partial", { paid: formatINR(d.paid_amount), left: formatINR(d.outstanding) })}
          </div>
        )}
      </section>

      {d.late_fee > 0 && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">{t("pay.lateFee", { amount: formatINR(d.late_fee) })}</p>}

      {d.paid ? (
        <div className="rounded-2xl bg-gain-soft px-6 py-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-gain" />
          <h2 className="mt-3 text-xl font-extrabold text-gain-ink">{t("pay.paidTitle")}</h2>
          <p className="mt-1 text-gain-ink">{t("pay.paidBody", { business: b })}</p>
        </div>
      ) : (
        <>
          <Card title={t("pay.howToPay")}>
            {d.upi_link ? (
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-surface-border">
                  <QRCodeSVG value={d.upi_link} size={176} level="M" fgColor="#0B1B2B" />
                </div>
                <p className="text-center text-sm text-ink-soft">{t("pay.scan")}</p>
                <a href={d.upi_link} className="btn-primary w-full sm:hidden"><Smartphone size={18} /> {t("pay.payApp")}</a>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(d.upi_id);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="btn-secondary w-full"
                >
                  <Copy size={16} /> {copied ? t("pay.upiCopied") : `${t("pay.copyUpi")} · ${d.upi_id}`}
                </button>
              </div>
            ) : (
              !d.razorpay_url && <p className="text-[15px] text-ink-soft">{t("pay.noMethod", { business: b })}</p>
            )}
            {d.razorpay_url && (
              <a href={d.razorpay_url} target="_blank" rel="noreferrer" className={`btn-primary w-full ${d.upi_link ? "mt-4" : ""}`}>
                <CreditCard size={18} /> {t("pay.online")}
              </a>
            )}
          </Card>

          <Card title={t("pay.alreadyPaid")} body={t("pay.alreadyPaidBody", { business: b })}>
            {d.claim || done.claim ? (
              <p className="rounded-xl bg-gold-50 px-4 py-3 text-[15px] font-semibold text-gold-700">
                {d.claim ? t("pay.claimPending", { business: b, amount: formatINR(d.claim.amount) }) : t("pay.claimSent", { business: b })}
              </p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); claim.mutate(); }} className="space-y-3">
                <label htmlFor="ref" className="field-label">{t("pay.ref")}</label>
                <input id="ref" className="field" value={refNo} onChange={(e) => setRefNo(e.target.value)} maxLength={60} />
                <button type="submit" disabled={claim.isPending} className="btn-ink w-full"><CheckCircle2 size={17} /> {t("pay.iPaid")}</button>
              </form>
            )}
          </Card>

          <Card title={t("pay.needTime")} body={t("pay.needTimeBody", { business: b })}>
            {d.promise_date || done.promise ? (
              <p className="rounded-xl bg-info-soft px-4 py-3 text-[15px] font-semibold text-info">
                {t("pay.promiseSent", { business: b, date: formatDate(d.promise_date || promiseDate, { day: "numeric", month: "long" }) })}
              </p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); promise.mutate(); }} className="space-y-3">
                <input aria-label={t("pay.promiseBtn")} type="date" required min={todayStr()} max={plusDays(90)} className="field" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
                <button type="submit" disabled={promise.isPending} className="btn-secondary w-full">{t("pay.promiseBtn")}</button>
              </form>
            )}
          </Card>

          <Card title={t("pay.message", { business: b })}>
            {done.note ? (
              <p className="rounded-xl bg-surface px-4 py-3 text-[15px] font-semibold text-ink-soft">{t("pay.messageSent")}</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); note.mutate(); }} className="space-y-3">
                <textarea aria-label={t("pay.message", { business: b })} required maxLength={300} rows={3} className="field resize-none" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("pay.messageHint")} />
                <button type="submit" disabled={note.isPending || !message.trim()} className="btn-secondary w-full">{t("pay.sendMessage")}</button>
              </form>
            )}
          </Card>
        </>
      )}

      {(claim.isError || promise.isError || note.isError) && <p role="alert" className="rounded-xl bg-loss-soft px-4 py-3 text-sm font-semibold text-loss">{t("pay.error")}</p>}
      <p className="pt-2 text-center text-xs text-ink-muted">{t("pay.poweredBy")}</p>
    </>
  );
}
