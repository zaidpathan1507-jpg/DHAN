export const EXPENSE_CATEGORIES = [
  "Raw Material & Stock",
  "Salaries & Wages",
  "Rent",
  "Utilities",
  "Transport & Fuel",
  "Food & Refreshments",
  "Marketing",
  "Repairs & Maintenance",
  "Taxes & Fees",
  "Others",
];

export const INCOME_CATEGORIES = ["Sales Revenue", "Services Rendered", "Other Income"];

export const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque"];

export function formatINR(amount) {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPct(pct) {
  if (pct === null || pct === undefined) return null;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
