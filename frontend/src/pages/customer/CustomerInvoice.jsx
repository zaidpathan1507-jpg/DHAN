import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, CircleAlert, CircleCheck, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import ErrorState from "../../components/common/ErrorState.jsx";
import Skeleton from "../../components/common/Skeleton.jsx";
import PayModal from "../../components/customer/PayModal.jsx";
import { relativeTime } from "../../components/udhaar/udhaarUi.js";
import api from "../../lib/apiClient.js";
import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import { InvoiceChips } from "./CustomerHome.jsx";

const REASONS = ["wrong_amount", "not_received", "already_paid", "other"];
const toISO = (d) => d.toISOString().slice(0, 10);

export default function CustomerInvoice() {
  const { id } = useParams();
  const { t, locale, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [date, setDate] = useState(() => toISO(new Date(Date.now() + 5 * 864e5)));
  const [reason, setReason] = useState("wrong_amount");
  const [detail, setDetail] = useState("");
  const [text, setText] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["customer"] });

  const query = useQuery({ queryKey: ["customer", "invoice", id], queryFn: () => api.get(`/customer/invoices/${id}`).then((r) => r.data), refetchInterval: 6000 });
  const promise = useMutation({ mutationFn: () => api.post(`/customer/invoices/${id}/promise`, { date }), onSuccess: () => { setPromiseOpen(false); refresh(); } });
  const dispute = useMutation({ mutationFn: () => api.post(`/customer/invoices/${id}/dispute`, { reason, text: detail || null }), onSuccess: () => { setDisputeOpen(false); setDetail(""); refresh(); } });
  const message = useMutation({ mutationFn: () => api.post(`/customer/invoices/${id}/message`, { text: text.trim() }), onSuccess: () => { setText(""); refresh(); } });

  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (query.isError) return <div className="card"><ErrorState onRetry={query.refetch} /></div>;
  const v = query.data;
  const shop = v.shop.name;
  const chat = v.timeline.filter((e) => e.type === "msg");
  const history = v.timeline.filter((e) => e.type !== "msg" && e.type !== "sent").reverse();
  const today = toISO(new Date());
  const max = toISO(new Date(Date.now() + 90 * 864e5));

  const label = (e) => {
    const p = e.params;
    return t(`cu.ev.${e.type}`, { amount: formatINR(p.amount), date: p.date ? formatDate(p.date, { day: "numeric", month: "short" }) : "", reason: p.reason ? t(`cu.reason.${p.reason}`) : "" });
  };

  return (
    <div className="space-y-5">
      <Link to="/c" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink"><ArrowLeft size={16} /> {t("cu.back")}</Link>

      <section className="card p-5 md:p-6">
        <p className="text-sm font-bold text-ink-muted">{shop} · {v.shop.city}</p>
        <p className="mt-1 text-base font-semibold text-ink">{v.note}</p>
        <p className="mt-4 text-sm font-semibold text-ink-muted">{t("cu.amountDue")}</p>
        <p className="num text-[44px] font-extrabold leading-none text-ink">{formatINR(v.outstanding)}</p>
        {v.paid_amount > 0 && <p className="num mt-1 text-sm font-semibold text-ink-muted">{t("cu.ofTotal", { total: formatINR(v.amount) })}</p>}
        <p className="mt-2 text-sm text-ink-soft">{t("cu.due", { date: formatDate(v.due_date) })}</p>
        <span className="mt-2 block"><InvoiceChips v={v} /></span>
        {v.late_fee > 0 && <p className="mt-2 text-sm font-semibold text-warn">{t("cu.lateFee", { amount: formatINR(v.late_fee) })}</p>}

        {v.paid ? (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-gain-soft px-4 py-3 text-[15px] font-bold text-gain-ink"><CircleCheck size={19} /> {t("cu.paidFull")}</p>
        ) : (
          <>
            {v.failed && (
              <div role="alert" className="mt-5 rounded-xl bg-loss-soft p-4 text-loss">
                <p className="flex items-center gap-2 text-[15px] font-extrabold"><CircleAlert size={19} /> {t("cu.failedTitle", { reason: t(`cu.reason.${v.failed.reason}`) })}</p>
                <p className="mt-1 text-sm font-semibold">{t("cu.failedBody", { shop })}</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button onClick={() => setPaying(true)} className="btn-primary">{v.failed ? t("cu.retry") : t("cu.pay")} · {formatINR(v.outstanding)}</button>
              <button onClick={() => { setPromiseOpen((o) => !o); setDisputeOpen(false); }} className="btn-secondary"><CalendarClock size={17} /> {t("cu.promiseTitle")}</button>
              {!v.disputed && <button onClick={() => { setDisputeOpen((o) => !o); setPromiseOpen(false); }} className="btn-secondary"><ShieldQuestion size={17} /> {t("cu.dispute")}</button>}
            </div>
            {v.disputed && <p className="mt-4 rounded-xl bg-warn-soft px-4 py-3 text-sm font-bold text-warn">{t("cu.disputeOpen", { shop })}</p>}

            {promiseOpen && (
              <form onSubmit={(e) => { e.preventDefault(); promise.mutate(); }} className="mt-4 rounded-xl bg-surface p-4">
                <p className="text-sm text-ink-soft">{t("cu.promiseBody", { shop })}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input aria-label={t("cu.promiseTitle")} type="date" required min={today} max={max} value={date} onChange={(e) => setDate(e.target.value)} className="field w-auto" />
                  <button type="submit" disabled={promise.isPending} className="btn-ink">{t("cu.promiseBtn")}</button>
                </div>
              </form>
            )}
            {disputeOpen && (
              <form onSubmit={(e) => { e.preventDefault(); dispute.mutate(); }} className="mt-4 space-y-3 rounded-xl bg-surface p-4">
                <p className="text-sm font-extrabold text-ink">{t("cu.disputeTitle")}</p>
                <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                  {REASONS.map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-sm font-bold ${reason === r ? "border-ink bg-surface-card text-ink" : "border-surface-border text-ink-soft"}`}>{t(`cu.dr.${r}`)}</button>
                  ))}
                </div>
                <textarea aria-label={t("cu.disputeTitle")} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={400} rows={2} className="field" placeholder={t("cu.msgPlaceholder")} />
                <p className="text-xs text-ink-muted">{t("cu.disputeNote")}</p>
                <button type="submit" disabled={dispute.isPending} className="btn-ink">{t("cu.disputeSend")}</button>
              </form>
            )}
          </>
        )}
      </section>

      <section className="card p-5" aria-labelledby="cu-chat">
        <h2 id="cu-chat" className="text-base font-extrabold text-ink">{t("cu.messages", { shop })}</h2>
        <ul className="mt-3 space-y-2.5">
          {!chat.length && <li className="text-sm text-ink-soft">{t("cu.noMessages")}</li>}
          {chat.map((e, i) => {
            const mine = e.params.sender === "customer";
            return (
              <li key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-surface text-ink"}`}>
                  <p className={`text-xs font-bold ${mine ? "text-white/70" : "text-ink-muted"}`}>{mine ? t("cu.you") : shop}</p>
                  <p className="text-[15px]">{e.params.text}</p>
                  <p className={`mt-0.5 text-[11px] ${mine ? "text-white/60" : "text-ink-muted"}`}>{relativeTime(e.at, locale)}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) message.mutate(); }} className="mt-4 flex gap-2">
          <input aria-label={t("cu.msgPlaceholder")} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} className="field" placeholder={t("cu.msgPlaceholder")} />
          <button type="submit" disabled={message.isPending || !text.trim()} className="btn-ink shrink-0">{t("cu.send")}</button>
        </form>
      </section>

      <section className="card p-5" aria-labelledby="cu-hist">
        <h2 id="cu-hist" className="text-base font-extrabold text-ink">{t("cu.history")}</h2>
        <ol className="mt-3 space-y-3">
          {history.map((e, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-ink">{label(e)}</span>
              <span className="shrink-0 text-xs text-ink-muted">{relativeTime(e.at, locale)}</span>
            </li>
          ))}
        </ol>
      </section>

      {paying && <PayModal invoice={v} onClose={() => setPaying(false)} onPromise={() => setPromiseOpen(true)} />}
    </div>
  );
}
