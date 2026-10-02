import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_MODES } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import ConfidenceField from "../ocr/ConfidenceField.jsx";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TransactionForm({
  type,
  initialValues = {},
  confidences = {},
  onSubmit,
  submitting,
  submitLabel,
}) {
  const { t, tr } = useI18n();
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [values, setValues] = useState({
    amount: initialValues.amount ?? "",
    vendor: initialValues.vendor ?? "",
    category: initialValues.category ?? categories[0],
    txn_date: initialValues.txn_date ?? todayStr(),
    payment_mode: initialValues.payment_mode ?? "Cash",
    description: initialValues.description ?? "",
    gstin: initialValues.gstin ?? "",
  });
  const [showMore, setShowMore] = useState(Boolean(initialValues.gstin || initialValues.description));

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...values, amount: parseFloat(values.amount) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ConfidenceField label={t("txn.amount")} htmlFor="txn-amount" confidence={confidences.amount}>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-ink-muted">₹</span>
          <input
            id="txn-amount"
            required
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={values.amount}
            onChange={set("amount")}
            className="field num min-h-[60px] pl-10 text-[28px] font-extrabold"
            placeholder="0"
          />
        </div>
      </ConfidenceField>

      <ConfidenceField label={t("txn.vendor")} htmlFor="txn-vendor" confidence={confidences.vendor}>
        <input
          id="txn-vendor"
          required
          type="text"
          value={values.vendor}
          onChange={set("vendor")}
          className="field"
          placeholder={t("txn.vendorHint")}
        />
      </ConfidenceField>

      <ConfidenceField label={t("txn.category")} htmlFor="txn-category" confidence={confidences.category}>
        <select id="txn-category" value={values.category} onChange={set("category")} className="field">
          {categories.map((c) => (
            <option key={c} value={c}>
              {tr("cat", c)}
            </option>
          ))}
        </select>
      </ConfidenceField>

      <ConfidenceField label={t("txn.date")} htmlFor="txn-date" confidence={confidences.date}>
        <input
          id="txn-date"
          required
          type="date"
          value={values.txn_date}
          onChange={set("txn_date")}
          max={todayStr()}
          className="field"
        />
      </ConfidenceField>

      <fieldset>
        <legend className="field-label">{t("txn.paymentMode")}</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {PAYMENT_MODES.map((m) => {
            const active = values.payment_mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setValues((v) => ({ ...v, payment_mode: m }))}
                className={`min-h-[44px] rounded-xl border px-3.5 text-sm font-bold transition-colors ${
                  active
                    ? "border-ink bg-ink text-white"
                    : "border-surface-strong bg-surface-card text-ink-soft hover:bg-surface-muted"
                }`}
              >
                {tr("pay", m)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          aria-expanded={showMore}
          className="inline-flex min-h-[40px] items-center gap-1 text-sm font-bold text-ink-soft hover:text-ink"
        >
          {showMore ? t("txn.lessDetails") : t("txn.moreDetails")}
          <ChevronDown size={16} className={`transition-transform ${showMore ? "rotate-180" : ""}`} />
        </button>

        {showMore && (
          <div className="mt-3 animate-fade-up space-y-5">
            {type === "expense" && (
              <ConfidenceField label={t("txn.gstinOpt")} htmlFor="txn-gstin" confidence={confidences.gstin}>
                <input
                  id="txn-gstin"
                  type="text"
                  value={values.gstin}
                  onChange={set("gstin")}
                  className="field uppercase"
                  placeholder="27AAAPL1234C1Z5"
                />
              </ConfidenceField>
            )}
            <div>
              <label htmlFor="txn-desc" className="field-label">
                {t("txn.descOpt")}
              </label>
              <textarea
                id="txn-desc"
                value={values.description}
                onChange={set("description")}
                rows={2}
                className="field resize-none"
                placeholder={t("txn.noteHint")}
              />
            </div>
          </div>
        )}
      </div>

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? t("txn.saving") : submitLabel || t("txn.save")}
      </button>
    </form>
  );
}
