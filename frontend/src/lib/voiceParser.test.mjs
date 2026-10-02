// Self-check: node src/lib/voiceParser.test.mjs
import assert from "node:assert/strict";
import { parseSpokenTransaction as p } from "./voiceParser.js";

const a = p("paid 500 rupees to Sharma Transport for petrol by UPI");
assert.deepEqual([a.type, a.amount, a.vendor, a.category, a.payment_mode], ["expense", 500, "Sharma Transport", "Transport & Fuel", "UPI"]);

const b = p("Laxmi Fabrics ko 5 hazaar diye cash");
assert.deepEqual([b.type, b.amount, b.vendor, b.payment_mode], ["expense", 5000, "Laxmi Fabrics", "Cash"]);

const c = p("आज 12000 रुपये मिले रमेश से");
assert.deepEqual([c.type, c.amount, c.vendor, c.category], ["income", 12000, "रमेश", "Sales Revenue"]);

const d = p("received 1.5 lakh from Kalyani Tech");
assert.deepEqual([d.type, d.amount, d.vendor], ["income", 150000, "Kalyani Tech"]);

const e = p("chai 40 rupees");
assert.deepEqual([e.amount, e.category, e.type], [40, "Food & Refreshments", "expense"]);

const f = p("मला २५०० रुपये मिळाले सुनील कडून");
assert.deepEqual([f.type, f.amount, f.vendor], ["income", 2500, "सुनील"]);

assert.equal(p("something unclear").amount, null);
console.log("voiceParser: all checks passed");
