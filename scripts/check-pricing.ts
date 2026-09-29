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

// price rules: -20% before 12:00, +10% last minute (< 2h)
const rules = { priceRules: [{ label: "Vormittag", percent: -20, toHour: 12 }, { label: "Last Minute", percent: 10, maxLeadHours: 2 }] } as never;
const at = (h: number) => new Date(Date.UTC(2030, 0, 7, h - 1)); // Zurich winter = UTC+1, Monday
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: false, settings: { priceRules: [{ label: "Mo", percent: -50, weekdays: [1] }] } as never, start: at(9) }).total, 20);
const far = at(9).getTime() - 48 * 3_600_000;
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: false, settings: rules, start: at(9), now: far }).total, 32);
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: false, settings: rules, start: at(15), now: far }).total, 40);
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: false, settings: rules, start: at(15), now: at(14).getTime() }).total, 44);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, settings: rules, start: at(9), now: far }).total, 0);
console.log("price rules ok");
