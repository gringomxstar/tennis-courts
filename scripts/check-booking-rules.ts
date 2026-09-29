import assert from "node:assert/strict";
import { ballMachineConflict, checkBookingRules, slotLimitFor, type RuleInput } from "../src/lib/booking-rules";

const H = 3_600_000;
const now = Date.UTC(2030, 0, 7, 8); // Monday
const at = (h: number) => new Date(now + h * H);
const own = (h: number, sport: "TENNIS" | "PADEL" = "TENNIS", guestCount = 0) => ({
  startsAt: at(h).toISOString(), endsAt: at(h + 1).toISOString(), sport, guestCount,
});
const marly = { marlyRuleEnabled: true, maxActiveSlotsPerPlayer: 2, marlyCooldownMinutes: 60 } as never;
const base: RuleInput = { settings: marly, role: "MEMBER", plan: null, sport: "TENNIS", start: at(10), end: at(11), isDouble: false, guestCount: 0, mine: [], now };

assert.equal(checkBookingRules(base), null);
// Marly: max 2 active
assert.match(checkBookingRules({ ...base, mine: [own(2), own(5)] })!, /Maximal 2/);
// finished bookings don't count (rolling release)
assert.equal(checkBookingRules({ ...base, mine: [own(-5), own(-3), own(5)] }), null);
// consecutive single blocked, double allowed
assert.match(checkBookingRules({ ...base, mine: [own(9)] })!, /aufeinanderfolgende/);
assert.equal(checkBookingRules({ ...base, isDouble: true, mine: [own(9)] }), null);
// cooldown
assert.match(checkBookingRules({ ...base, mine: [own(8.5)] })!, /Pause/);
// coach exempt from consecutive; unlimited via slotLimits
const limits = { ...(marly as object), slotLimits: { MEMBER: { TENNIS: 2, PADEL: 3 }, COACH: {} } } as never;
assert.equal(checkBookingRules({ ...base, settings: limits, role: "COACH", mine: [own(9), own(2), own(4), own(6)] }), null);
assert.equal(slotLimitFor(limits, "COACH", "TENNIS"), Infinity);
// per sport: padel counts separately
assert.equal(checkBookingRules({ ...base, settings: limits, sport: "PADEL", mine: [own(2), own(5), own(20, "PADEL")] }), null);
assert.match(checkBookingRules({ ...base, settings: limits, sport: "PADEL", mine: [own(2, "PADEL"), own(5, "PADEL"), own(20, "PADEL")] })!, /Maximal 3 aktive Padel/);
// no marly, no limits = unlimited
assert.equal(slotLimitFor(null, "MEMBER", "TENNIS"), Infinity);
// plan rules
const plan = { bookingWindowDays: 7, allowedDurations: [60], simultaneousBookingLimit: 3, guestsPerWeek: 2 };
const p: RuleInput = { ...base, settings: null, plan };
assert.equal(checkBookingRules(p), null);
assert.match(checkBookingRules({ ...p, start: at(24 * 8), end: at(24 * 8 + 1) })!, /7 Tage/);
assert.match(checkBookingRules({ ...p, end: at(11.5) })!, /60 Minuten/);
assert.equal(checkBookingRules({ ...p, end: at(12), isDouble: true }), null); // 2h double
assert.match(checkBookingRules({ ...p, mine: [own(2), own(4), own(6)] })!, /höchstens 3 aktive/);
assert.match(checkBookingRules({ ...p, guestCount: 1, mine: [own(-2, "TENNIS", 2)] })!, /2 Gäste pro Woche/);
assert.equal(checkBookingRules({ ...p, guestCount: 1, mine: [own(-24 * 3, "TENNIS", 2)] }), null); // last week
// ball machine
const bm = [{ id: "a", status: "CONFIRMED", hasBallMachine: true, startsAt: at(10).toISOString(), endsAt: at(11).toISOString() }];
assert.ok(ballMachineConflict(bm, at(10.5), at(11.5)));
assert.equal(ballMachineConflict(bm, at(11), at(12)), undefined);
assert.equal(ballMachineConflict(bm, at(10), at(11), "a"), undefined);
assert.match(checkBookingRules({ ...p, plan: { ...plan, dailyBookingLimit: 1 }, mine: [own(4)] })!, /1 Buchung pro Tag/);
assert.equal(checkBookingRules({ ...p, plan: { ...plan, dailyBookingLimit: 1 }, mine: [own(30)] }), null);
console.log("booking rules ok");
