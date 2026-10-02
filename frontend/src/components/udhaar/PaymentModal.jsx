import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import api from "../../lib/apiClient.js";
import { formatINR, PAYMENT_MODES, QUERY_KEYS_TO_REFRESH } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import Modal from "../common/Modal.jsx";
import { useToast } from "../common/Toast.jsx";

export default function PaymentModal({ open, onClose, item }) {
  const { t, tr } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("UPI");

  useEffect(() => {
    if (open && item) setAmount(String(item.outstanding));
  }, [open, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => api.post(`/receivables/${item.id}/payment`, { amount: parseFloat(amount), mode }),
    onSuccess: () => {
      ["receivables", "customers", "notifications", ...QUERY_KEYS_TO_REFRESH].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      showToast(t("ud.paymentRecorded"));
      onClose();
    },
    onError: () => showToast(t("txn.saveFail"), "error"),
  });

  if (!item) return null;
  return (
    <Modal open={open} onClose={onClose} title={t("ud.payTitle", { party: item.party })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-5"
      >
        <div>
          <label htmlFor="pay-amount" className="field-label">{t("ud.payAmount")}</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-ink-muted">₹</span>
            <input id="pay-amount" required autoFocus type="number" inputMode="decimal" min="1" max={item.outstanding} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field num min-h-[60px] pl-10 text-[28px] font-extrabold" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAmount(String(item.outstanding))} className="rounded-full border border-surface-strong px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-surface-muted">
              {t("ud.payFull", { amount: formatINR(item.outstanding) })}
            </button>
            <button type="button" onClick={() => setAmount(String(Math.round(item.outstanding / 2)))} className="rounded-full border border-surface-strong px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-surface-muted">
              {t("ud.payHalf")}
            </button>
            <span className="num ml-auto text-sm text-ink-muted">{t("ud.outstanding", { amount: formatINR(item.outstanding) })}</span>
          </div>
        </div>
        <fieldset>
          <legend className="field-label">{t("ud.payMode")}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {PAYMENT_MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`min-h-[44px] rounded-xl border px-3.5 text-sm font-bold ${mode === m ? "border-ink bg-ink text-white" : "border-surface-strong text-ink-soft hover:bg-surface-muted"}`}>
                {tr("pay", m)}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={save.isPending} className="btn-primary w-full">{t("ud.paySave")}</button>
      </form>
    </Modal>
  );
}
