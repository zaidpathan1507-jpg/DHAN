import { useState } from "react";

import ConfidenceField from "../ocr/ConfidenceField.jsx";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_MODES } from "../../lib/constants.js";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TransactionForm({
  type,
  initialValues = {},
  confidences = {},
  onSubmit,
  submitting,
  submitLabel = "Save Transaction",
}) {
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

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...values, amount: parseFloat(values.amount) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ConfidenceField label="Amount" confidence={confidences.amount}>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-soft">₹</span>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={values.amount}
            onChange={set("amount")}
            className="w-full rounded-xl border border-surface-border bg-surface-card pl-7 pr-3.5 py-2.5 text-lg font-semibold text-navy focus:border-dhan-green outline-none"
            placeholder="0"
          />
        </div>
      </ConfidenceField>

      <ConfidenceField label="Vendor" confidence={confidences.vendor}>
        <input
          required
          type="text"
          value={values.vendor}
          onChange={set("vendor")}
          className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none"
          placeholder="e.g. Laxmi Fabrics"
        />
      </ConfidenceField>

      <div className="grid grid-cols-2 gap-3">
        <ConfidenceField label="Date" confidence={confidences.date}>
          <input
            required
            type="date"
            value={values.txn_date}
            onChange={set("txn_date")}
            max={todayStr()}
            className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none"
          />
        </ConfidenceField>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-navy-soft/70 mb-1 block">
            Payment Mode
          </label>
          <select
            value={values.payment_mode}
            onChange={set("payment_mode")}
            className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none"
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ConfidenceField label="Category" confidence={confidences.category}>
        <select
          value={values.category}
          onChange={set("category")}
          className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </ConfidenceField>

      {type === "expense" && (
        <ConfidenceField label="GSTIN (optional)" confidence={confidences.gstin}>
          <input
            type="text"
            value={values.gstin}
            onChange={set("gstin")}
            className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none uppercase"
            placeholder="27AAAPL1234C1Z5"
          />
        </ConfidenceField>
      )}

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy-soft/70 mb-1 block">
          Description (optional)
        </label>
        <textarea
          value={values.description}
          onChange={set("description")}
          rows={2}
          className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none resize-none"
          placeholder="Add a note..."
        />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
