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

export const BUSINESS_TYPES = ["Retail", "Manufacturing", "Services", "Wholesale/Trading", "Food & Beverage", "Other"];

// en-IN groups digits the Indian way (12,34,567) for both languages.
export function formatINR(amount) {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Compact axis/label form in lakh and crore: ₹45k, ₹1.2L, ₹3.4Cr.
export function formatINRCompact(amount) {
  if (amount === null || amount === undefined) return "—";
  const sign = amount < 0 ? "-" : "";
  const v = Math.abs(amount);
  const trim = (n) => String(Number(n.toFixed(1)));
  if (v >= 1e7) return `${sign}₹${trim(v / 1e7)}Cr`;
  if (v >= 1e5) return `${sign}₹${trim(v / 1e5)}L`;
  if (v >= 1e3) return `${sign}₹${trim(v / 1e3)}k`;
  return `${sign}₹${Math.round(v)}`;
}

export function formatPct(pct) {
  if (pct === null || pct === undefined) return null;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// Backend titles arrive in ALL CAPS ("RENT SPENDING"); present them as sentence case.
export function sentenceCase(text = "") {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export const QUERY_KEYS_TO_REFRESH = [
  "dashboard-overview",
  "dashboard-cashflow",
  "dashboard-spending-mix",
  "dashboard-top-vendors",
  "transactions",
  "insights",
  "forecast",
  "credit-readiness",
];
