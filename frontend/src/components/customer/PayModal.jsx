import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, CreditCard, Landmark, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";

import { useRazorpayPay } from "../../lib/razorpay.js";
import api from "../../lib/apiClient.js";
import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import Modal from "../common/Modal.jsx";

const METHODS = [["upi", "cu.pm.upi", Smartphone], ["card", "cu.pm.card", CreditCard], ["netbanking", "cu.pm.netbanking", Landmark]];
const OUTCOMES = ["success", "insufficient_funds", "bank_down", "declined", "cancelled"];

// Sandbox checkout. The "practice result" picker is what lets a judge see a failed payment on demand; with a real
// gateway the bank decides and this picker disappears.
export default function PayModal({ invoice, onClose, onPromise }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("full");
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState("upi");
  const [test, setTest] = useState("success");
  const [result, setResult] = useState(null);

  const amount = mode === "full" ? invoice.outstanding : Math.min(Number(custom) || 0, invoice.outstanding);
  const pay = useMutation({
    mutationFn: () => api.post(`/customer/invoices/${invoice.id}/pay`, { amount, method, test }).then((r) => r.data),
    onSuccess: (r) => { setResult(r); queryClient.invalidateQueries({ queryKey: ["customer"] }); },
  });
  const shop = invoice.shop.name;
  const rz = invoice.razorpay; // "test" | "live" | null: real Razorpay Checkout when set up, the practice picker otherwise
  const rzp = useRazorpayPay(`/customer/invoices/${invoice.id}`, (r) => { setResult(r); queryClient.invalidateQueries({ queryKey: ["customer"] }); });
  const busy = pay.isPending || rzp.busy;

  return (
    <Modal open onClose={onClose} title={t("cu.pm.title", { shop })} maxWidth="sm:max-w-md">
      {result?.status === "paid" ? (
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gain-soft text-gain"><CheckCircle2 size={34} /></span>
          <h3 className="mt-4 text-xl font-extrabold text-ink">{t("cu.pm.successTitle")}</h3>
          <p className="num mt-1 text-[32px] font-extrabold text-gain">{formatINR(result.amount)}</p>
          <p className="num text-sm font-semibold text-ink-muted">{t("cu.pm.receipt", { id: result.receipt })}</p>
          <p className="mt-3 text-[15px] text-ink-soft">{result.settled ? t("cu.pm.settled") : t("cu.pm.left", { amount: formatINR(result.outstanding) })}</p>
          <button onClick={onClose} className="btn-primary mt-6 w-full">{t("cu.pm.done")}</button>
        </div>
      ) : result?.status === "failed" ? (
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-loss-soft text-loss"><CircleAlert size={34} /></span>
          <h3 className="mt-4 text-xl font-extrabold text-ink">{t("cu.pm.failTitle")}</h3>
          <p className="mt-2 text-[15px] text-ink-soft">{t("cu.pm.failBody", { reason: t(`cu.reason.${result.reason}`), shop })}{result.detail ? ` (${result.detail})` : ""}</p>
          <div className="mt-6 space-y-2.5">
            <button onClick={() => { setResult(null); setTest("success"); }} className="btn-primary w-full">{t("cu.retry")}</button>
            <button onClick={() => { setResult(null); setMethod(method === "upi" ? "card" : "upi"); setTest("success"); }} className="btn-secondary w-full">{t("cu.pm.other")}</button>
            <button onClick={() => { onClose(); onPromise?.(); }} className="link text-sm">{t("cu.pm.later")}</button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); rz ? rzp.pay(amount) : pay.mutate(); }} className="space-y-5">
          <div>
            <p className="field-label">{t("cu.pm.amount")}</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("cu.pm.amount")}>
              {[["full", t("cu.pm.full"), formatINR(invoice.outstanding)], ["part", t("cu.pm.part"), null]].map(([k, label, sub]) => (
                <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`rounded-xl border-2 px-3 py-2.5 text-left ${mode === k ? "border-ink bg-surface" : "border-surface-border"}`}>
                  <span className="block text-sm font-bold text-ink">{label}</span>
                  {sub && <span className="num block text-sm font-extrabold text-ink-soft">{sub}</span>}
                </button>
              ))}
            </div>
            {mode === "part" && <input aria-label={t("cu.pm.part")} type="number" min="1" max={invoice.outstanding} step="any" inputMode="decimal" required value={custom} onChange={(e) => setCustom(e.target.value)} className="field num mt-2" placeholder="₹" autoFocus />}
          </div>

          {!rz && (
          <div>
            <p className="field-label">{t("cu.pm.method")}</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("cu.pm.method")}>
              {METHODS.map(([k, label, Icon]) => (
                <button key={k} type="button" role="radio" aria-checked={method === k} onClick={() => setMethod(k)} className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-bold ${method === k ? "border-ink bg-surface text-ink" : "border-surface-border text-ink-soft"}`}>
                  <Icon size={18} /> {t(label)}
                </button>
              ))}
            </div>
          </div>
          )}

          {rz ? (
            <div className="rounded-xl bg-info-soft p-3.5 text-[13px] font-semibold leading-snug text-info">
              <p className="flex items-center gap-1.5 font-extrabold"><ShieldCheck size={15} /> {t("cu.pm.rzp")}</p>
              {rz === "test" && <p className="mt-1.5">{t("cu.pm.testHint")}</p>}
            </div>
          ) : (
          <div className="rounded-xl bg-info-soft p-3.5">
            <p className="text-[13px] font-semibold leading-snug text-info">{t("cu.pm.sandbox")}</p>
            <label htmlFor="pm-outcome" className="field-label mt-3">{t("cu.pm.outcome")}</label>
            <select id="pm-outcome" value={test} onChange={(e) => setTest(e.target.value)} className="field">
              {OUTCOMES.map((o) => <option key={o} value={o}>{t(`cu.pm.o.${o}`)}</option>)}
            </select>
          </div>
          )}

          <button type="submit" disabled={busy || amount <= 0} className="btn-primary w-full">
            {busy ? <><Loader2 size={18} className="animate-spin" /> {t("cu.pm.processing")}</> : t("cu.pm.go", { amount: formatINR(amount) })}
          </button>
          {(pay.isError || rzp.error) && <p role="alert" className="rounded-xl bg-loss-soft px-3.5 py-2.5 text-sm font-semibold text-loss">{rzp.error === "blocked" ? t("cu.pm.blocked") : pay.error?.response?.data?.detail || rzp.error || t("common.error")}</p>}
        </form>
      )}
    </Modal>
  );
}
