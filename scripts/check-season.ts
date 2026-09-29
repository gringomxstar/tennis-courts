import assert from "node:assert/strict";
import { seasonEnd } from "../src/lib/membership";

const z = (s: string) => seasonEnd(new Date(s)).toISOString();
assert.equal(z("2026-09-29T10:00:00Z"), "2027-03-31T21:59:59.000Z"); // autumn → next 31 March
assert.equal(z("2027-02-10T10:00:00Z"), "2027-03-31T21:59:59.000Z"); // February → same 31 March (no bonus)
assert.equal(z("2027-03-31T21:00:00Z"), "2027-03-31T21:59:59.000Z"); // last evening of the season
assert.equal(z("2027-03-31T22:00:00Z"), "2028-03-31T21:59:59.000Z"); // 1 April 00:00 Zurich → new season
// renewal: next Abo starts 1s after the old end and runs the whole following season
assert.equal(z(new Date(Date.parse("2027-03-31T21:59:59Z") + 1000).toISOString()), "2028-03-31T21:59:59.000Z");
assert.equal(new Date("2027-03-31T21:59:59Z").toLocaleString("de-CH", { timeZone: "Europe/Zurich" }), "31.3.2027, 23:59:59");
console.log("season ok");
