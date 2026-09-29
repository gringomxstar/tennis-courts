import assert from "node:assert/strict";
import { formatIban, isValidIban } from "../src/lib/iban";

assert.equal(isValidIban("CH9300762011623852957"), true); // PostFinance example IBAN
assert.equal(isValidIban("CH9300790012345678901"), false); // the old placeholder on the invoice page
assert.equal(isValidIban("CH93"), false);
assert.equal(formatIban("CH9300762011623852957"), "CH93 0076 2011 6238 5295 7");
console.log("iban ok");
