import assert from "node:assert/strict";
import { applyReply, icsFor, seatsTaken, waitlistPosition } from "../src/lib/events";

type R = "INVITED" | "YES" | "NO" | "WAITLIST";
const t = (m: number) => new Date(2026, 5, 1, 12, m);
const inv = (id: string, reply: R, plusOnes = 0, m = 0) => ({ id, reply, plusOnes, respondedAt: reply === "INVITED" ? null : t(m) });
const ev = { maxSeats: 10 as number | null, maxPlusOnes: 2, deadline: new Date(2026, 5, 10) };
const now = new Date(2026, 5, 2);
const state = (r: ReturnType<typeof applyReply>, id: string) => r.invites.find((i) => i.id === id)!.reply;

// 10 Plätze, 9 belegt (4 Zusagen mit je 1 Begleitperson = 8, plus 1 Einzelperson)
const base = [inv("a", "YES", 1), inv("b", "YES", 1), inv("c", "YES", 1), inv("d", "YES", 1), inv("e", "YES"), inv("me", "INVITED")];
assert.equal(seatsTaken(base), 9);
assert.equal(state(applyReply(ev, base, "me", "YES", 1, now), "me"), "WAITLIST");
assert.equal(state(applyReply(ev, base, "me", "YES", 0, now), "me"), "YES");

// Absage einer Zusage mit Begleitung: früheste Wartende rückt nach, spätere nicht (kein Platz mehr)
const full = [inv("a", "YES", 1), inv("b", "YES", 1), inv("c", "YES", 1), inv("d", "YES", 1), inv("e", "YES", 1), inv("w1", "WAITLIST", 0, 1), inv("w2", "WAITLIST", 0, 2), inv("w3", "WAITLIST", 0, 3)];
const r1 = applyReply(ev, full, "a", "NO", 0, now);
assert.deepEqual(r1.promoted, ["w1", "w2"]); // 2 Plätze frei
assert.equal(state(r1, "w3"), "WAITLIST");
const r1b = applyReply(ev, full, "a", "YES", 0, now); // Reduktion: 1 Platz frei
assert.deepEqual(r1b.promoted, ["w1"]);
assert.equal(waitlistPosition(full, "w2"), 2);

// Wartende mit zu vielen Begleitpersonen wird übersprungen, nächste passt
const skip = [inv("a", "YES", 1), inv("b", "YES", 1), inv("c", "YES", 1), inv("d", "YES", 1), inv("e", "YES", 1), inv("big", "WAITLIST", 2, 1), inv("small", "WAITLIST", 0, 2)];
const r2 = applyReply(ev, skip, "a", "NO", 0, now); // 2 frei, big braucht 3
assert.deepEqual(r2.promoted, ["small"]);
assert.equal(state(r2, "big"), "WAITLIST");

// Nach Anmeldeschluss: Zusage abgelehnt, Absage erlaubt
const late = new Date(2026, 5, 11);
assert.throws(() => applyReply(ev, base, "me", "YES", 0, late));
assert.equal(state(applyReply(ev, base, "a", "NO", 0, late), "a"), "NO");

// Ohne maxSeats nie Warteliste
const open = { maxSeats: null, maxPlusOnes: 2, deadline: null };
const many = Array.from({ length: 50 }, (_, i) => inv("x" + i, "YES", 2));
assert.equal(state(applyReply(open, [...many, inv("me", "INVITED")], "me", "YES", 2, now), "me"), "YES");

// Begleitpersonen über dem Maximum abgelehnt
assert.throws(() => applyReply(ev, base, "me", "YES", 3, now));

// ICS
const ics = icsFor({ id: "1", title: "Apéro, Sommer; fein", startsAt: new Date(Date.UTC(2026, 5, 1, 16, 0)), endsAt: new Date(Date.UTC(2026, 5, 1, 18, 0)) }, "https://x/e/1");
assert.ok(ics.includes("BEGIN:VEVENT"));
assert.ok(ics.includes("DTSTART:20260601T160000Z"));
assert.ok(ics.includes("SUMMARY:Apéro\\, Sommer\; fein"));
assert.ok(ics.includes("\r\n"));
console.log("events ok");
