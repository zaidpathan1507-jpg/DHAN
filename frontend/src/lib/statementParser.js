// Parses a bank-statement CSV (HDFC / ICICI / SBI / Axis style exports and most others) into DHAN transactions.
// Column roles are found by header name, so column order and extra columns do not matter.
import { guessCategory } from "./categoryGuess.js";

export function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t" || ch === ";") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim()));
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim()));
  return rows;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

export function parseDate(raw) {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`; // Indian statements are day-first
  m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[a-z]*[-/ ,]*(\d{2,4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  return null;
}

function parseAmount(raw) {
  if (!raw) return null;
  const neg = /^\(.*\)$/.test(raw) || /\bdr\b/i.test(raw) || raw.trim().startsWith("-");
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? { value: n, neg } : null;
}

const STOP = /^(upi|dr|cr|neft|imps|rtgs|payment|pay|to|from|ref|txn|transfer|ibl|ybl|okaxis|okhdfcbank|oksbi|axl|paytm|apl|bank|pos|atm|chq|cheque|mob|mobile|banking|inb|ifn|ft|deposit)$/i;

export function vendorFromNarration(raw) {
  const narration = raw.replace(/^(pos|ecom)\s+[\dX*]+\s+/i, ""); // card swipes: drop the masked card number
  const parts = narration.split(/[/|*]|\s-\s|-(?=[A-Za-z@])/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const name = part.includes("@") ? part.split("@")[0].replace(/[._\d]+/g, " ").trim() : part;
    if (name.length >= 3 && /[A-Za-z]{3}/.test(name) && !name.split(/\s+/).every((w) => STOP.test(w)) && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(name) && !/^\d/.test(name)) {
      return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
    }
  }
  return narration.slice(0, 40) || "Bank entry";
}

const paymentFrom = (n) =>
  /\bupi\b/i.test(n) ? "UPI" : /\b(neft|imps|rtgs)\b/i.test(n) ? "Bank Transfer" : /\b(chq|cheque)\b/i.test(n) ? "Cheque" : /\batm\b/i.test(n) ? "Cash" : /\b(pos|card)\b/i.test(n) ? "Card" : "Bank Transfer";

// -> { rows: [{type, amount, vendor, category, txn_date, payment_mode, description}], skipped, error? }
export function parseStatement(text) {
  const grid = parseCSV(text);
  const headerAt = grid.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /(narration|description|particulars|remarks|details|debit|credit|withdrawal|deposit|amount)/i.test(c)));
  if (headerAt < 0) return { rows: [], skipped: 0, error: "no-header" };

  const head = grid[headerAt].map((h) => h.toLowerCase());
  const col = (re) => head.findIndex((h) => re.test(h));
  const c = {
    date: col(/^(txn |transaction |value |posting )?date/),
    desc: col(/(narration|description|particulars|remarks|details)/),
    debit: col(/(debit|withdrawal|paid out|money out)/),
    credit: col(/(credit|deposit|paid in|money in)/),
    amount: col(/^(txn |transaction )?amount/),
    drcr: col(/(dr\s*\/\s*cr|^type$|cr\/dr)/),
  };
  if (c.date < 0 || (c.debit < 0 && c.credit < 0 && c.amount < 0)) return { rows: [], skipped: 0, error: "no-columns" };

  const rows = [];
  let skipped = 0;
  for (const r of grid.slice(headerAt + 1)) {
    const txn_date = parseDate(r[c.date] || "");
    const debit = c.debit >= 0 ? parseAmount(r[c.debit]) : null;
    const credit = c.credit >= 0 ? parseAmount(r[c.credit]) : null;
    let type, amount;
    if (debit || credit) [type, amount] = debit ? ["expense", debit.value] : ["income", credit.value];
    else if (c.amount >= 0 && parseAmount(r[c.amount])) {
      const a = parseAmount(r[c.amount]);
      const flag = c.drcr >= 0 ? r[c.drcr] : "";
      type = /dr|debit|withdraw/i.test(flag) || a.neg ? "expense" : "income";
      amount = a.value;
    }
    if (!txn_date || !amount) { skipped++; continue; }
    const narration = (c.desc >= 0 ? r[c.desc] : "") || "";
    const vendor = vendorFromNarration(narration);
    rows.push({
      type, amount, vendor, txn_date,
      category: guessCategory(`${narration} ${vendor}`, type),
      payment_mode: paymentFrom(narration),
      description: narration.slice(0, 200) || null,
    });
  }
  return { rows, skipped };
}
