// Keyword rules shared by voice entry and bank-statement import. English plus Hindi/Marathi (Devanagari and
// the Roman spellings people actually type). First match wins; the user always reviews before anything is saved.

const EXPENSE_RULES = [
  ["Transport & Fuel", ["petrol", "diesel", "fuel", "cng", "uber", "ola ", "rapido", "cab", "toll", "transport", "tempo", "पेट्रोल", "डीजल", "भाड़ा", "भाडे", "ट्रांसपोर्ट"]],
  ["Rent", ["rent", "kiraya", "kiraaya", "bhade", "किराया", "भाडे", "भाड्याने"]],
  ["Salaries & Wages", ["salary", "salaries", "wages", "payroll", "tankhwah", "tankha", "pagar", "majduri", "stipend", "incentive", "तनख्वाह", "वेतन", "पगार", "मजदूरी", "मजुरी"]],
  ["Utilities", ["electricity", "bijli", "water bill", "wifi", "internet", "broadband", "airtel", "jio", "aws", "amazon web", "mongodb", "server", "hosting", "msedcl", "mseb", "recharge", "बिजली", "पानी", "इंटरनेट"]],
  ["Marketing", ["google ads", "meta ads", "meta platforms", "facebook", "instagram", "advert", "marketing", "promotion", "influencer", "hoarding", "pamphlet", "flyer", "cashback", "विज्ञापन", "प्रचार", "जाहिरात"]],
  ["Food & Refreshments", ["chai", "tea", "lunch", "dinner", "snacks", "zomato", "swiggy", "caterer", "catering", "khana", "nashta", "pantry", "चाय", "खाना", "नाश्ता", "जेवण", "चहा"]],
  ["Repairs & Maintenance", ["repair", "maintenance", "servicing", "marammat", "plumber", "मरम्मत", "दुरुस्ती"]],
  ["Taxes & Fees", ["gst", "tax", "tds", "challan", "licence", "license", "filing", "gateway", "razorpay fee", "जीएसटी", "टैक्स", "कर"]],
  ["Raw Material & Stock", ["stock", "maal", "material", "uniform", "kit", "wholesale", "supplies", "inventory", "purchase", "माल", "सामान", "कच्चा"]],
];

const INCOME_RULES = [
  ["Services Rendered", ["service", "subscription", "contract", "invoice", "retainer", "सेवा"]],
  ["Other Income", ["interest", "refund", "cashback", "funding", "grant", "dividend", "ब्याज", "व्याज"]],
];

const INCOME_WORDS = ["received", "receive", "got ", "earned", "sold", "sale", "credited", "mila", "mili", "mile", "aaya", "aayi", "bika", "becha", "jama", "milale", "मिला", "मिले", "मिली", "आया", "आई", "बेचा", "बिका", "जमा", "मिळाले", "मिळाला", "विकले", "आले", "कमाई"];
const EXPENSE_WORDS = ["paid", "pay ", "spent", "bought", "gave", "purchase", "diye", "diya", "diye", "kharcha", "kharch", "bhara", "kharida", "dena", "दिए", "दिया", "दिये", "खर्च", "भरा", "खरीदा", "भरले", "दिले", "खर्चा", "खरेदी"];

const PAYMENT_RULES = [
  ["UPI", ["upi", "gpay", "google pay", "phonepe", "paytm", "bhim", "यूपीआई", "यू पी आई"]],
  ["Cash", ["cash", "नकद", "कैश", "रोख"]],
  ["Cheque", ["cheque", "check ", "chq", "चेक"]],
  ["Card", ["card", "pos ", "कार्ड"]],
  ["Bank Transfer", ["neft", "imps", "rtgs", "bank", "transfer", "बैंक"]],
];

const find = (rules, text) => rules.find(([, words]) => words.some((w) => text.includes(w)))?.[0];

export function guessCategory(text, type) {
  const s = ` ${text.toLowerCase()} `;
  if (type === "income") return find(INCOME_RULES, s) || "Sales Revenue";
  return find(EXPENSE_RULES, s) || "Others";
}

export function guessPaymentMode(text, fallback = "Cash") {
  return find(PAYMENT_RULES, ` ${text.toLowerCase()} `) || fallback;
}

// Which spoken word comes first decides the direction; no cue at all means an expense.
export function guessType(text) {
  const s = ` ${text.toLowerCase()} `;
  const first = (words) => Math.min(...words.map((w) => (s.indexOf(w) < 0 ? Infinity : s.indexOf(w))));
  return first(INCOME_WORDS) < first(EXPENSE_WORDS) ? "income" : "expense";
}

export const isTypeWord = (word) => [...INCOME_WORDS, ...EXPENSE_WORDS].some((w) => w.trim() === word);
