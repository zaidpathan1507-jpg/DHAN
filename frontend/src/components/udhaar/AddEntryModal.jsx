import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

import api from "../../lib/apiClient.js";
import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import Modal from "../common/Modal.jsx";
import { useToast } from "../common/Toast.jsx";

const inDays = (n) => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4 + n * 864e5).toISOString().slice(0, 10);
const digits = (s) => (s || "").replace(/\D/g, "").slice(-10);

export default function AddEntryModal({ open, onClose, initialKind = "receivable", prefill, onCreated }) {
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const blank = () => ({ party: "", phone: "", email: "", amount: "", due_date: inDays(15), note: "", late_fee_pct: 0, auto_remind: true, lang });
  const [kind, setKind] = useState(initialKind);
  const [form, setForm] = useState(blank);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  useEffect(() => {
    if (open) {
      setKind(prefill ? "receivable" : initialKind);
      setForm({ ...blank(), ...(prefill || {}) });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const customers = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/receivables/customers").then((r) => r.data), enabled: open && kind === "receivable" });
  const known = customers.data?.find((c) => (digits(form.phone) && c.key === digits(form.phone)) || c.party.toLowerCase() === form.party.trim().toLowerCase());
  const amount = parseFloat(form.amount) || 0;
  const overLimit = known && known.suggested_limit != null && known.outstanding + amount > known.suggested_limit && known.label !== "risky";

  const save = useMutation({
    mutationFn: () =>
      api.post("/receivables", {
        ...form,
        kind,
        amount: parseFloat(form.amount),
        phone: form.phone.replace(/\D/g, "") || null,
        email: form.email.trim() || null,
        note: form.note || null,
        late_fee_pct: Number(form.late_fee_pct),
      }).then((r) => r.data),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      showToast(t("rec.saved"));
      onClose();
      if (kind === "receivable" && (item.phone || item.email)) onCreated?.(item);
    },
    onError: () => showToast(t("txn.saveFail"), "error"),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("ud.addTitle")} maxWidth="sm:max-w-xl">
      <div role="radiogroup" className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl bg-surface-muted p-1">
        {[
          ["receivable", t("rec.kindReceivable")],
          ["payable", t("rec.kindPayable")],
        ].map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-[46px] rounded-lg text-sm font-extrabold transition-colors ${kind === k ? "bg-surface-card text-ink shadow-subtle" : "text-ink-soft"}`}>
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="ue-party" className="field-label">{t("rec.party")}</label>
          <input id="ue-party" required className="field" value={form.party} onChange={set("party")} placeholder={t("rec.partyHint")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ue-amount" className="field-label">{t("rec.amount")}</label>
            <input id="ue-amount" required type="number" inputMode="decimal" min="1" step="0.01" className="field num" value={form.amount} onChange={set("amount")} placeholder="0" />
          </div>
          <div>
            <label htmlFor="ue-due" className="field-label">{t("rec.due")}</label>
            <input id="ue-due" required type="date" className="field" value={form.due_date} onChange={set("due_date")} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ink-soft">{t("ud.dueIn")}</span>
          {[7, 15, 30, 45].map((n) => (
            <button key={n} type="button" onClick={() => set("due_date")(inDays(n))} className={`min-h-[34px] rounded-full border px-3 font-bold ${form.due_date === inDays(n) ? "border-ink bg-ink text-white" : "border-surface-strong text-ink-soft hover:bg-surface-muted"}`}>
              {t("ud.days", { n })}
            </button>
          ))}
        </div>

        {kind === "receivable" && (
          <>
            {known && known.label === "risky" && (
              <p role="status" className="flex items-start gap-2 rounded-xl bg-loss-soft px-4 py-3 text-sm font-semibold text-loss">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {t("ud.riskyCustomer", { party: known.party, score: known.score })}
              </p>
            )}
            {overLimit && (
              <p role="status" className="flex items-start gap-2 rounded-xl bg-gold-50 px-4 py-3 text-sm font-semibold text-gold-700">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {t("ud.aboveLimit", { limit: formatINR(known.suggested_limit), party: known.party })}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ue-phone" className="field-label">{t("rec.phone")}</label>
                <input id="ue-phone" type="tel" inputMode="numeric" className="field" value={form.phone} onChange={set("phone")} placeholder="98765 43210" />
              </div>
              <div>
                <label htmlFor="ue-email" className="field-label">{t("ud.email")}</label>
                <input id="ue-email" type="email" className="field" value={form.email} onChange={set("email")} placeholder="accounts@company.com" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="field-label">{t("ud.customerLang")}</span>
                <div role="radiogroup" className="flex gap-2">
                  {[["en", "English"], ["hi", "हिन्दी"]].map(([l, label]) => (
                    <button key={l} type="button" role="radio" aria-checked={form.lang === l} onClick={() => set("lang")(l)} className={`min-h-[44px] flex-1 rounded-xl border text-sm font-bold ${form.lang === l ? "border-ink bg-ink text-white" : "border-surface-strong text-ink-soft"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="ue-fee" className="field-label">{t("ud.lateFeeLabel")}</label>
                <select id="ue-fee" className="field" value={form.late_fee_pct} onChange={set("late_fee_pct")}>
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>{n ? t("ud.lateFeePct", { n }) : t("ud.lateFeeNone")}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl bg-surface px-4">
              <input type="checkbox" checked={form.auto_remind} onChange={(e) => set("auto_remind")(e.target.checked)} className="h-5 w-5" />
              <span className="text-[15px] font-bold text-ink">{t("ud.autoRemindLabel")}</span>
            </label>
          </>
        )}

        <div>
          <label htmlFor="ue-note" className="field-label">{t("rec.note")}</label>
          <input id="ue-note" className="field" value={form.note} onChange={set("note")} />
        </div>
        <button type="submit" disabled={save.isPending} className="btn-primary w-full">{t("rec.save")}</button>
      </form>
    </Modal>
  );
}
