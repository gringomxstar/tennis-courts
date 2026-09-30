import assert from "node:assert/strict";
import { ballMachineConflict, checkBookingRules, checkBookingWindow, slotLimitFor, weeklyStarts, type RuleInput } from "../src/lib/booking-rules";

const H = 3_600_000;
const now = Date.UTC(2030, 0, 7, 8); // Monday
const DAY_MS = 86_400_000;
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
// Abo Soleil: Mo–Fr 8–16; z(h) = h:00 Zurich (winter = UTC+1) on a Monday far ahead
const z = (h: number) => new Date(Date.UTC(2030, 0, 7, h - 1));
const ps: RuleInput = { ...p, now: z(0).getTime() - DAY_MS };
const soleil = { ...plan, sports: ["TENNIS" as const], playWindow: { weekdays: [1, 2, 3, 4, 5], fromHour: 8, toHour: 16 } };
assert.equal(checkBookingRules({ ...ps, plan: soleil, start: z(10), end: z(11) }), null);
assert.match(checkBookingRules({ ...ps, plan: soleil, start: z(15), end: z(17) })!, /Mo–Fr 8–16 Uhr/);
assert.match(checkBookingRules({ ...ps, plan: soleil, start: z(7), end: z(8) })!, /nur Mo–Fr/);
assert.equal(checkBookingRules({ ...ps, plan: soleil, sport: "PADEL", start: z(18), end: z(19) }), null); // padel not covered, paid instead
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
// no per-day limit: only active bookings count, played ones free a slot the same day
assert.equal(checkBookingRules({ ...base, mine: [own(-3), own(-1), own(5)] }), null);
assert.match(checkBookingRules({ ...base, mine: [own(-3), own(3), own(5)] })!, /Maximal 2/);
console.log("booking rules ok");

// coaches: no marly fallback limit, own Abo ignored
assert.equal(slotLimitFor(marly, "COACH", "TENNIS"), Infinity);
assert.equal(checkBookingRules({ ...base, role: "COACH", plan: { bookingWindowDays: 1, allowedDurations: [60], simultaneousBookingLimit: 1 }, start: at(24 * 5), end: at(24 * 5 + 1), mine: [own(2), own(4)] }), null);
// weekly series keeps club wall-clock time across the DST switch (25.10.2026)
{
  const first = new Date("2026-10-13T16:00:00Z"); // Tue 18:00 Zurich (CEST)
  const s = weeklyStarts(first, new Date("2026-11-03T23:00:00Z"));
  assert.deepEqual(s.map((d) => d.toISOString()), ["2026-10-13T16:00:00.000Z", "2026-10-20T16:00:00.000Z", "2026-10-27T17:00:00.000Z", "2026-11-03T17:00:00.000Z"]);
  assert.equal(weeklyStarts(first, new Date("2030-01-01")).length, 53);
}
console.log("coach + series ok");
// opening hours, slot grid, horizon (club time; January = UTC+1)
{
  const settings = { openingHour: 8, closingHour: 22, slotDurationMinutes: 60 };
  const n = Date.UTC(2030, 0, 7, 8); // Mon 09:00 club time
  const t = (h: number, m = 0, day = 0) => new Date(Date.UTC(2030, 0, 7 + day, h - 1, m)); // h in club time
  const w = (start: Date, mins = 60, plan?: { bookingWindowDays: number }) =>
    checkBookingWindow({ settings, plan, start, end: new Date(start.getTime() + mins * 60_000), now: n });
  assert.equal(w(t(10, 0, 1)), null);
  assert.equal(w(t(21, 0, 1)), null); // ends exactly at closing
  assert.match(w(t(3, 0, 1))!, /8 bis 22/);
  assert.match(w(t(21, 0, 1), 120)!, /8 bis 22/); // runs past closing
  assert.match(w(t(10, 7, 1))!, /Startzeit/); // off grid
  assert.equal(w(t(10, 0, 6)), null); // within 7 days is fine
  assert.match(w(t(10, 0, 9))!, /7 Tage/); // default horizon
  assert.equal(w(t(10, 0, 20), 60, { bookingWindowDays: 30 }), null); // plan horizon wins
  assert.match(w(t(10, 0, 40), 60, { bookingWindowDays: 30 })!, /30 Tage/);
}
console.log("window ok");
