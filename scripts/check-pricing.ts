import assert from "node:assert/strict";
import { computeBookingCost, needsFloodlight } from "../src/lib/pricing";

const outdoor = { sportType: "TENNIS" as const, isIndoor: false, hourlyRate: 30 };
const padel = { sportType: "PADEL" as const, isIndoor: false, hourlyRate: 40 };
const base = { settings: null, guestCount: 0, hasBallMachine: false, hasLighting: false, durationMinutes: 60 };

assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false }).total, 0);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: true }).total, 30);
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: false }).total, 40);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, guestCount: 1 }).total, 15);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, hasBallMachine: true, durationMinutes: 120 }).total, 20);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, hasLighting: true }).total, 5);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: true, settings: { guestFee: 20, defaultHourlyRateTennis: 25 } as never, guestCount: 1 }).total, 45);
assert.equal(needsFloodlight({ hasLighting: true }, 19), true);
assert.equal(needsFloodlight({ hasLighting: true }, 18), false);
assert.equal(needsFloodlight({ hasLighting: false }, 20), false);
console.log("pricing ok");
