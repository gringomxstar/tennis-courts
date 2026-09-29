import assert from "node:assert/strict";
import { passwordToken, verifyPasswordToken } from "../src/lib/booking-link";

const exp = Date.now() + 60_000;
const t = passwordToken("u1", null, exp);
assert.equal(verifyPasswordToken("u1", null, exp, t), true);
assert.equal(verifyPasswordToken("u1", "$2a$hash", exp, t), false); // password set → link dead
assert.equal(verifyPasswordToken("u2", null, exp, t), false);
assert.equal(verifyPasswordToken("u1", null, exp + 1, t), false); // tampered expiry
assert.equal(verifyPasswordToken("u1", null, exp, t, exp + 1), false); // expired
assert.equal(verifyPasswordToken("u1", null, exp, undefined), false);
console.log("password token ok");
