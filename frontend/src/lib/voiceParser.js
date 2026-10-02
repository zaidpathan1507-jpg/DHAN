import { guessCategory, guessPaymentMode, guessType, isTypeWord } from "./categoryGuess.js";

const DEVANAGARI_DIGITS = "०१२३४५६७८९";
const UNITS = [
  [/^(crore|cr|करोड़|करोड)$/, 1e7],
  [/^(lakh|lakhs|lac|lacs|लाख)$/, 1e5],
  [/^(thousand|hazaar|hazar|hajar|k|हज़ार|हजार)$/, 1e3],
  [/^(hundred|sau|सौ|शे)$/, 100],
];
const CURRENCY = /^(rs\.?|₹|rupees?|rupaye|rupay|रुपये|रुपए|रुपया|रु\.?)$/;
const FILLER = new Set(["to", "from", "at", "for", "via", "by", "on", "using", "through", "of", "the", "a", "an", "in", "ko", "se", "ne", "ka", "ki", "ke", "ला", "को", "से", "ने", "का", "की", "के", "कडून", "आज", "कल", "today", "yesterday", "aaj", "kal", "काल"]);
const VENDOR_MARKERS = new Set(["to", "from", "ko", "se", "को", "से", "ला", "कडून", "at"]);

const normalise = (s) => s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d))).replace(/[,।!?]/g, " ");

function parseAmount(tokens) {
  const start = tokens.findIndex((t) => /^\d+(\.\d+)?$/.test(t.replace(/^₹/, "")));
  if (start < 0) return { amount: null, used: new Set() };
  let amount = parseFloat(tokens[start].replace(/^₹/, ""));
  const used = new Set([start]);
  const unit = UNITS.find(([re]) => re.test(tokens[start + 1] || ""));
  if (unit) {
    amount *= unit[1];
    used.add(start + 1);
  }
  return { amount: Math.round(amount * 100) / 100, used };
}

const isoDay = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// "paid 500 to Sharma Transport for petrol by UPI" / "Laxmi Fabrics ko 5 hazaar diye" / "आज 12000 रुपये मिले रमेश से"
export function parseSpokenTransaction(heard) {
  const text = normalise(heard).trim();
  const tokens = text.split(/\s+/).filter(Boolean);
  const lower = tokens.map((t) => t.toLowerCase());
  const { amount, used } = parseAmount(lower);

  const type = guessType(text);
  const txn_date = /\b(yesterday|kal)\b|कल|काल/i.test(text) ? isoDay(-1) : isoDay(0);

  // vendor: up to three words next to a marker ("... ko", "to ..."), else whatever is left over
  const keep = (i) => !used.has(i) && !CURRENCY.test(lower[i]) && !FILLER.has(lower[i]) && !isTypeWord(lower[i]) && !guessPaymentMode(lower[i], "") && !/^\d/.test(lower[i]);
  const clean = (i) => !used.has(i) && !CURRENCY.test(lower[i]) && !isTypeWord(lower[i]) && !/^\d/.test(lower[i]) && !guessPaymentMode(lower[i], "");
  let vendorWords = [];
  const m = lower.findIndex((t) => VENDOR_MARKERS.has(t));
  if (m >= 0) {
    const english = ["to", "from", "at"].includes(lower[m]);
    const idx = english
      ? [m + 1, m + 2, m + 3].filter((i) => i < tokens.length)
      : [m - 3, m - 2, m - 1].filter((i) => i >= 0);
    const stop = english ? /^(for|via|by|on|using|through)$/ : /^(ko|se|को|से)$/;
    vendorWords = idx.filter((i) => clean(i) && !stop.test(lower[i]) && !FILLER.has(lower[i]) && !UNITS.some(([re]) => re.test(lower[i])));
  }
  if (!vendorWords.length) vendorWords = tokens.map((_, i) => i).filter(keep).slice(0, 3);
  const vendor = vendorWords.map((i) => tokens[i]).join(" ").replace(/^./, (c) => c.toUpperCase());

  return {
    heard,
    type,
    amount,
    vendor,
    category: guessCategory(text, type),
    payment_mode: guessPaymentMode(text, type === "income" ? "UPI" : "Cash"),
    txn_date,
  };
}
