import assert from "node:assert/strict";
import { computeBookingCost, needsFloodlight } from "../src/lib/pricing";

const outdoor = { sportType: "TENNIS" as const, isIndoor: false, hourlyRate: 30 };
const hall = { sportType: "TENNIS" as const, isIndoor: true, hourlyRate: 45 };
const padel = { sportType: "PADEL" as const, isIndoor: false, hourlyRate: 40 };
const base = { settings: null, hasBallMachine: false, hasLighting: false, durationMinutes: 60 };
const ABO = ["TENNIS" as const];
const cost = (court: typeof outdoor | typeof padel, players: ((typeof ABO) | null)[], extra: object = {}) => computeBookingCost({ ...base, court, players, ...extra });

// Club rules (owner, 2026-09-29): the court price is split by the players, an Abo covers its holder's share,
// the booker alone pays the rest; everybody needs an Abo to play free (no role exceptions).
assert.equal(cost(outdoor, [null]).total, 30); // guest alone
assert.equal(cost(outdoor, [null, null]).total, 30); // guest + guest: booker pays both shares, no guest fee on top
assert.equal(cost(outdoor, [null, ABO]).total, 15); // guest + member with Abo: 50 %
assert.equal(cost(outdoor, [null, ABO, ABO]).total, 10); // guest + 2 members: 1/3
assert.equal(cost(outdoor, [ABO]).total, 0); // member with Abo
assert.equal(cost(outdoor, [ABO, null]).total, 15); // member brings a guest: the guest's share
assert.equal(cost(outdoor, [ABO, null, null, null]).total, 22.5); // doubles, 3 guests: 3 × 7.50
assert.equal(cost(outdoor, [ABO, ABO, ABO, ABO]).total, 0);
assert.equal(cost(outdoor, [null, ABO, null]).total, 20); // 2 of 3 shares
assert.equal(computeBookingCost({ ...base, court: outdoor, players: [null, ABO, ABO], settings: { defaultHourlyRateTennis: 25 } as never }).total, 8.35); // 8.333 → 5 Rappen
assert.equal(cost(hall, [ABO, ABO]).total, 45); // the hall is never in an Abo
assert.equal(cost(padel, [ABO]).total, 40); // tennis Abo doesn't cover padel
assert.equal(cost(padel, [["PADEL"] as never, null]).total, 20);
assert.equal(cost(outdoor, [["PADEL"] as never]).total, 30); // padel-only Abo doesn't cover tennis
assert.equal(cost(outdoor, [ABO], { hasBallMachine: true, durationMinutes: 120 }).total, 20);
assert.equal(cost(outdoor, [ABO], { hasLighting: true }).total, 0); // floodlight free by default
assert.equal(cost(outdoor, [ABO], { hasLighting: true, settings: { floodlightFee: 5 } }).total, 5);
assert.equal(cost(outdoor, [null, ABO], { durationMinutes: 120 }).total, 30);
// z(h) = h:00 Zurich (summer, UTC+2), independent of the machine's time zone
const z = (h: number, m = 0) => new Date(Date.UTC(2030, 6, 1, h - 2, m));
assert.equal(needsFloodlight({ hasLighting: true }, z(19), 60), true);
assert.equal(needsFloodlight({ hasLighting: true }, z(18), 60), false); // ends 19:00
assert.equal(needsFloodlight({ hasLighting: true }, z(18), 90), true); // runs until 19:30
assert.equal(needsFloodlight({ hasLighting: true }, z(18), 120), true);
assert.equal(needsFloodlight({ hasLighting: false }, z(20), 60), false);
// Diner Tennis Mo–Fr 11–13: an Abo holder brings one player free; mon() = Zurich winter hours on a Monday
const diner = { dinerTennis: { enabled: true, weekdays: [1, 2, 3, 4, 5], fromHour: 11, toHour: 13 } } as never;
const mon = (h: number) => new Date(Date.UTC(2030, 0, 7, h - 1));
assert.equal(cost(outdoor, [ABO, null], { settings: diner, start: mon(12) }).total, 0);
assert.equal(cost(outdoor, [ABO, null, null], { settings: diner, start: mon(11) }).total, 10);
assert.equal(cost(outdoor, [ABO, null], { settings: diner, start: mon(13) }).total, 15); // after lunch
assert.equal(cost(outdoor, [null, ABO], { settings: diner, start: mon(12) }).total, 15); // booker without Abo
assert.equal(cost(outdoor, [ABO, null], { settings: diner, start: new Date(Date.UTC(2030, 0, 12, 11)) }).total, 15); // Saturday
console.log("pricing ok");

// price rules: -20% before 12:00, +10% last minute (< 2h)
const rules = { priceRules: [{ label: "Vormittag", percent: -20, toHour: 12 }, { label: "Last Minute", percent: 10, maxLeadHours: 2 }] } as never;
const at = (h: number) => new Date(Date.UTC(2030, 0, 7, h - 1)); // Zurich winter = UTC+1, Monday
assert.equal(computeBookingCost({ ...base, court: padel, players: [null], settings: { priceRules: [{ label: "Mo", percent: -50, weekdays: [1] }] } as never, start: at(9) }).total, 20);
const far = at(9).getTime() - 48 * 3_600_000;
assert.equal(computeBookingCost({ ...base, court: padel, players: [null], settings: rules, start: at(9), now: far }).total, 32);
assert.equal(computeBookingCost({ ...base, court: padel, players: [null], settings: rules, start: at(15), now: far }).total, 40);
assert.equal(computeBookingCost({ ...base, court: padel, players: [null], settings: rules, start: at(15), now: at(14).getTime() }).total, 44);
assert.equal(computeBookingCost({ ...base, court: outdoor, players: [ABO], settings: rules, start: at(9), now: far }).total, 0);
console.log("price rules ok");
