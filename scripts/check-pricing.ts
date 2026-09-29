import assert from "node:assert/strict";
import { computeBookingCost, needsFloodlight, paysGuestRate } from "../src/lib/pricing";

const outdoor = { sportType: "TENNIS" as const, isIndoor: false, hourlyRate: 30 };
const padel = { sportType: "PADEL" as const, isIndoor: false, hourlyRate: 40 };
const base = { settings: null, guestCount: 0, hasBallMachine: false, hasLighting: false, durationMinutes: 60 };

assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false }).total, 0);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: true }).total, 30);
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: false }).total, 40);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, guestCount: 1 }).total, 15);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, hasBallMachine: true, durationMinutes: 120 }).total, 20);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, hasLighting: true }).total, 0); // floodlight free by default
assert.equal(computeBookingCost({ ...base, settings: { floodlightFee: 5 } as never, court: outdoor, isGuest: false, hasLighting: true }).total, 5);
// guest rate: full court, no guest fee on top for the co-players (the court price is per court, not per person)
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: true, settings: { guestFee: 20, defaultHourlyRateTennis: 25 } as never, guestCount: 1 }).total, 25);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: true, guestCount: 3 }).total, 30);
// z(h) = h:00 Zurich (summer, UTC+2), independent of the machine's time zone
const z = (h: number, m = 0) => new Date(Date.UTC(2030, 6, 1, h - 2, m));
assert.equal(needsFloodlight({ hasLighting: true }, z(19), 60), true);
assert.equal(needsFloodlight({ hasLighting: true }, z(18), 60), false); // ends 19:00
assert.equal(needsFloodlight({ hasLighting: true }, z(18), 90), true); // runs until 19:30
assert.equal(needsFloodlight({ hasLighting: true }, z(18), 120), true);
assert.equal(needsFloodlight({ hasLighting: false }, z(20), 60), false);
assert.equal(paysGuestRate(false, null, false), true);
assert.equal(paysGuestRate(true, "GUEST", false), true); // registered/claimed account without Abo
assert.equal(paysGuestRate(true, "GUEST", true), false);
assert.equal(paysGuestRate(true, "MEMBER", false), false);
assert.equal(paysGuestRate(true, "COACH", false), false);
assert.equal(paysGuestRate(true, null, false), true); // logged in, but not part of this club
assert.equal(paysGuestRate(true, undefined, true), false);
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: false, planSports: ["PADEL"] }).total, 0); // padel Abo
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: false, planSports: ["TENNIS"] }).total, 40);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, planSports: ["PADEL"] }).total, 30); // padel-only Abo
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, planSports: ["TENNIS", "PADEL"] }).total, 0);
assert.equal(computeBookingCost({ ...base, court: padel, isGuest: true, planSports: ["PADEL"] }).total, 40); // guest rate wins
// Diner Tennis Mo–Fr 11–13: 1 free guest for members with Abo; at() = Zurich winter hours on a Monday
const diner = { dinerTennis: { enabled: true, weekdays: [1, 2, 3, 4, 5], fromHour: 11, toHour: 13 }, guestFee: 15 } as never;
const mon = (h: number) => new Date(Date.UTC(2030, 0, 7, h - 1));
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, planSports: ["TENNIS"], settings: diner, guestCount: 1, start: mon(12) }).guests, 0);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, planSports: ["TENNIS"], settings: diner, guestCount: 2, start: mon(11) }).guests, 15);
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, planSports: ["TENNIS"], settings: diner, guestCount: 1, start: mon(13) }).guests, 15); // after lunch
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, planSports: null, settings: diner, guestCount: 1, start: mon(12) }).guests, 15); // no Abo
assert.equal(computeBookingCost({ ...base, court: outdoor, isGuest: false, planSports: ["TENNIS"], settings: diner, guestCount: 1, start: new Date(Date.UTC(2030, 0, 12, 11)) }).guests, 15); // Saturday
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
