import { CheckCircle2, Copy, ExternalLink, History, Send, Smartphone, Trash2, Wallet } from "lucide-react";

import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import { relativeTime } from "./udhaarUi.js";

const iconBtn = "flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink";

function Pill({ tone, children }) {
  return <span className={`chip px-2.5 py-0.5 ${tone}`}>{children}</span>;
}

export default function UdhaarCard({ item, readOnly = false, highlight, onSend, onPay, onTimeline, onPhone, onConfirm, onReject, onDelete, onCopy }) {
  const { t, locale, formatDate } = useI18n();
  const receivable = item.kind === "receivable";
  const promised = item.promise_date && new Date(item.promise_date) >= new Date(new Date().toDateString());
  const partial = item.paid_amount > 0 && !item.paid;

  return (
    <li id={`udhaar-${item.id}`} className={`rounded-2xl border bg-surface-card p-4 shadow-subtle transition-shadow md:p-5 ${highlight ? "border-gold-500 ring-2 ring-gold-500" : "border-surface-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold text-ink">{item.party}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {t("rec.dueOn", { date: formatDate(item.due_date) })}
            {item.note ? ` · ${item.note}` : ""}
          </p>
        </div>
        <p className="num text-[22px] font-extrabold text-ink">{formatINR(item.outstanding)}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.days_overdue > 0 && <Pill tone="bg-loss-soft text-loss">{t("rec.late", { n: item.days_overdue })}</Pill>}
        {item.disputed && <Pill tone="bg-warn-soft text-warn">{t("ud.disputedChip")}</Pill>}
        {item.last_failure?.type === "pay_failed" && !item.paid && <Pill tone="bg-loss-soft text-loss">{t("ud.failedChip", { reason: t(`cu.reason.${item.last_failure.params.reason}`) })}</Pill>}
        {item.late_fee > 0 && <Pill tone="bg-warn-soft text-warn">{t("ud.lateFee", { amount: formatINR(item.late_fee) })}</Pill>}
        {receivable && (
          <>
            {item.claim ? (
              <Pill tone="bg-gold-100 text-gold-700">{t("ud.saysPaid", { amount: formatINR(item.claim.amount) })}</Pill>
            ) : promised ? (
              <Pill tone="bg-info-soft text-info">{t("ud.promised", { date: formatDate(item.promise_date, { day: "numeric", month: "short" }) })}</Pill>
            ) : null}
            {item.views > 0 ? (
              <Pill tone="bg-gain-soft text-gain-ink">{t("ud.seen", { when: relativeTime(item.last_viewed_at, locale) })}</Pill>
            ) : item.last_sent_at ? (
              <Pill tone="bg-surface-muted text-ink-soft">{t("ud.sentNotOpened")}</Pill>
            ) : (
              <Pill tone="bg-surface-muted text-ink-soft">{t("ud.notSent")}</Pill>
            )}
          </>
        )}
      </div>

      {partial && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={t("ud.received", { paid: formatINR(item.paid_amount), total: formatINR(item.amount) })}>
            <div className="h-full rounded-full bg-gain" style={{ width: `${Math.min(100, (item.paid_amount / item.amount) * 100)}%` }} />
          </div>
          <p className="num mt-1 text-xs font-semibold text-ink-muted">{t("ud.received", { paid: formatINR(item.paid_amount), total: formatINR(item.amount) })}</p>
        </div>
      )}

      {item.claim && !readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-gold-50 p-3">
          <p className="min-w-0 flex-1 text-sm font-bold text-ink">
            {t("ud.saysPaid", { amount: formatINR(item.claim.amount) })}
            {item.claim.reference ? <span className="font-semibold text-ink-soft"> · {item.claim.reference}</span> : null}
          </p>
          <button onClick={() => onConfirm(item)} className="btn-primary min-h-[40px] px-3 py-2">
            <CheckCircle2 size={16} /> {t("ud.confirmReceived")}
          </button>
          <button onClick={() => onReject(item)} className="btn-secondary min-h-[40px] px-3 py-2">{t("ud.notReceived")}</button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-surface-border pt-3">
        {!readOnly && receivable && !item.claim && (
          <button onClick={() => onSend(item)} className={`min-h-[40px] px-3 py-2 ${item.last_sent_at ? "btn-secondary" : "btn-primary"}`}>
            <Send size={16} /> {item.last_sent_at ? t("ud.sendReminder") : t("ud.sendLink")}
          </button>
        )}
        {!readOnly && !item.claim && (
          <button onClick={() => onPay(item)} className="btn-ink min-h-[40px] px-3 py-2">
            <Wallet size={16} /> {receivable ? t("ud.recordPayment") : t("rec.markOut")}
          </button>
        )}
        <span className="ml-auto flex items-center">
          {receivable && (
            <>
              <button onClick={() => onTimeline(item)} aria-label={t("ud.timeline")} title={t("ud.timeline")} className={iconBtn}><History size={18} /></button>
              <button onClick={() => onPhone(item)} aria-label={t("ud.customerPhone")} title={t("ud.customerPhone")} className={iconBtn}><Smartphone size={18} /></button>
              <button onClick={() => onCopy(item)} aria-label={t("ud.copyLink")} title={t("ud.copyLink")} className={iconBtn}><Copy size={18} /></button>
              <a href={item.link} target="_blank" rel="noreferrer" aria-label={t("ud.openLink")} title={t("ud.openLink")} className={iconBtn}><ExternalLink size={18} /></a>
            </>
          )}
          {!readOnly && <button onClick={() => onDelete(item)} aria-label={t("rec.delete")} title={t("rec.delete")} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-loss-soft hover:text-loss"><Trash2 size={18} /></button>}
        </span>
      </div>
    </li>
  );
}
