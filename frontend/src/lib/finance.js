// EMI = P·r·(1+r)^n / ((1+r)^n − 1), r = annual rate / 12. Mirrors the backend so previews match the lender's number.
export function emi(principal, ratePa, months) {
  const r = ratePa / 1200;
  if (!r) return Math.round(principal / months);
  return Math.round((principal * r * (1 + r) ** months) / ((1 + r) ** months - 1));
}
