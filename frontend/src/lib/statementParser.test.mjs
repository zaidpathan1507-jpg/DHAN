// Self-check: node src/lib/statementParser.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDate, parseStatement, vendorFromNarration } from "./statementParser.js";

assert.equal(parseDate("28/09/26"), "2026-09-28");
assert.equal(parseDate("05-Mar-2026"), "2026-03-05");
assert.equal(parseDate("2026-03-05"), "2026-03-05");
assert.equal(vendorFromNarration("UPI-SHARMA TRANSPORT-SHARMA.TRANS@OKAXIS-UTIB0000123-627100933"), "Sharma Transport");
assert.equal(vendorFromNarration("NEFT-HDFC0000123-PROGLOW BEAUTY WHOLESALE-REF8821"), "Proglow Beauty Wholesale");

const { rows, skipped, error } = parseStatement(readFileSync("public/sample-bank-statement.csv", "utf8"));
assert.equal(error, undefined);
assert.equal(rows.length, 16);
assert.equal(skipped, 0);
const razor = rows[0];
assert.deepEqual([razor.type, razor.amount, razor.txn_date, razor.payment_mode], ["income", 184250, "2026-09-28", "UPI"]);
assert.equal(rows.find((r) => r.vendor.includes("Hp Petrol")).category, "Transport & Fuel");
assert.equal(rows.find((r) => r.vendor.includes("Google")).category, "Marketing");
assert.equal(rows.find((r) => /Gst/i.test(r.vendor)).category, "Taxes & Fees");
assert.equal(parseStatement("hello,world\n1,2").error, "no-header");
console.log("statementParser: all checks passed (" + rows.length + " rows)");
