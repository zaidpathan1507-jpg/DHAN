import { BadgeCheck, Bell, CheckCheck, CircleAlert, CircleDollarSign, Clock, Eye, FilePlus2, Hand, HandCoins, MessageSquareText, Send, ShieldQuestion, XCircle } from "lucide-react";

import { formatINR } from "../../lib/constants.js";

// Reminder ladder (days relative to the due date); mirrors STEPS in the backend.
export const STEP_OFFSETS = [
  ["pre", -3],
  ["due", 0],
  ["late3", 3],
  ["late7", 7],
  ["final", 15],
];

export function relativeTime(date, locale) {
  const diffSec = (new Date(date).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export const EVENT_ICON = {
  created: FilePlus2,
  sent: Send,
  viewed: Eye,
  promise: Clock,
  note: MessageSquareText,
  claim: Hand,
  claim_confirmed: CheckCheck,
  claim_rejected: XCircle,
  payment: CircleDollarSign,
  settled: HandCoins,
  auto_reminder: Bell,
  due_changed: Clock,
  msg: MessageSquareText,
  pay_failed: CircleAlert,
  dispute: ShieldQuestion,
  dispute_resolved: CheckCheck,
  loan_approved: BadgeCheck,
  loan_declined: XCircle,
  loan_viewed: Eye,
};

export const EVENT_TONE = {
  created: "bg-surface-muted text-ink-soft",
  sent: "bg-info-soft text-info",
  viewed: "bg-gold-100 text-gold-700",
  promise: "bg-info-soft text-info",
  note: "bg-surface-muted text-ink-soft",
  claim: "bg-gold-100 text-gold-700",
  claim_confirmed: "bg-gain-soft text-gain-ink",
  claim_rejected: "bg-loss-soft text-loss",
  payment: "bg-gain-soft text-gain-ink",
  settled: "bg-gain-soft text-gain-ink",
  auto_reminder: "bg-info-soft text-info",
  due_changed: "bg-info-soft text-info",
  msg: "bg-info-soft text-info",
  pay_failed: "bg-loss-soft text-loss",
  dispute: "bg-warn-soft text-warn",
  dispute_resolved: "bg-gain-soft text-gain-ink",
  loan_approved: "bg-gain-soft text-gain-ink",
  loan_declined: "bg-loss-soft text-loss",
  loan_viewed: "bg-gold-100 text-gold-700",
};

export function describeEvent(e, { t, tr, formatDate }) {
  const p = e.params || {};
  switch (e.type) {
    case "sent":
      return t(p.status === "simulated" ? "ev.sentSim" : "ev.sent", { channel: p.channel === "email" ? t("ud.channelEmail") : t("ud.channelWhatsApp") });
    case "promise":
      return t("ev.promise", { date: formatDate(p.date, { day: "numeric", month: "short" }) });
    case "note":
      return t("ev.note", { text: p.text });
    case "claim":
    case "claim_confirmed":
    case "claim_rejected":
      return t(`ev.${e.type}`, { amount: formatINR(p.amount) });
    case "payment":
      return t("ev.payment", { amount: formatINR(p.amount), mode: tr("pay", p.mode) });
    case "auto_reminder":
      return t("ev.auto_reminder", { step: t(`step.${p.step}`) });
    case "msg":
      return t("ev.msg", { who: t(`ev.who.${p.sender === "owner" ? "owner" : "customer"}`), text: p.text });
    case "pay_failed":
      return t("ev.pay_failed", { amount: formatINR(p.amount), reason: t(`cu.reason.${p.reason}`) });
    case "dispute":
      return t("ev.dispute", { reason: t(`cu.dr.${p.reason}`) }) + (p.text ? ` · ${p.text}` : "");
    case "due_changed":
      return t("ev.due_changed", { old: formatDate(p.old, { day: "numeric", month: "short" }), new: formatDate(p.new, { day: "numeric", month: "short" }) });
    default:
      return t(`ev.${e.type}`);
  }
}

export function describeNotification(n, { t, formatDate }) {
  const p = n.params || {};
  const vars = { reason: p.reason ? t(`cu.reason.${p.reason}`) : "", party: p.party, lender: p.lender, rate: p.rate, amount: formatINR(p.amount), date: p.date ? formatDate(p.date, { day: "numeric", month: "short" }) : "" };
  const body = { pay_failed: "notif.pay_failedBody", viewed: "notif.viewedBody", promise: "notif.promiseBody", claim: "notif.claimBody", payment_auto: "notif.payment_autoBody", loan_approved: "notif.loan_approvedBody" }[n.type];
  return {
    title: t(`notif.${n.type}`, vars),
    body: n.type === "note" || n.type === "msg" ? p.text : n.type === "dispute" ? [p.reason && t(`cu.dr.${p.reason}`), p.text].filter(Boolean).join(" · ") : n.type === "claim" && p.reference ? `${t(body, vars)} · ${p.reference}` : body ? t(body, vars) : "",
  };
}

export const isLoanNotification = (type) => type.startsWith("loan_");
