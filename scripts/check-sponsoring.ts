// Sponsoring rules from the owner's brief (2026-10-07): 2 years −10 %, 3 years −15 %; a running contract
// covers every year of its term without a new request; portal hints "Nur noch 3 Plätze" / "Bereits vergeben".
import assert from "node:assert/strict";
import { isQRReferenceValid, isSCORReferenceValid } from "swissqrbill/utils";
import { DAY, DISCOUNT, MAIL_TEMPLATES, STAGES, contractEnd, fillPlaceholders, followUpDue, renewalReminderDue, campaignStep, confirmedLines, contractAmount, coversYear, dunningStep, hasYear, holdsPlace, itemHint, parseAddress, paymentReference, renewalRate, unbilledLines, yearlyAmount } from "../src/lib/sponsoring";
import { parseAmount, parseSponsors } from "../src/lib/sponsor-import";

// discounts and yearly amount
assert.deepEqual([DISCOUNT[1], DISCOUNT[2], DISCOUNT[3]], [0, 10, 15]);
assert.equal(yearlyAmount([{ quantity: 1, unitPrice: 1000 }], DISCOUNT[1]), 1000);
assert.equal(yearlyAmount([{ quantity: 1, unitPrice: 1000 }], DISCOUNT[2]), 900);
assert.equal(yearlyAmount([{ quantity: 2, unitPrice: 500 }, { quantity: 1, unitPrice: 300 }], DISCOUNT[3]), 1105);
assert.equal(yearlyAmount([{ quantity: 1, unitPrice: 333 }], 15), 283.05); // 283.05 rounded to 5 Rappen

// a 3-year contract from 2026 covers 2026–2028, not 2029; cancelled covers nothing
const c = { startYear: 2026, years: 3 };
assert.deepEqual([2025, 2026, 2027, 2028, 2029].map((y) => coversYear(c, y)), [false, true, true, true, false]);
assert.equal(coversYear({ ...c, cancelledAt: new Date() }, 2027), false);

// portal hints
assert.equal(itemHint(1, 1)?.text, "Bereits vergeben"); // exclusive object (container, centre court) taken
assert.equal(itemHint(1, 0, "Exklusiv")?.text, "Exklusiv");
assert.equal(itemHint(20, 17)?.text, "Nur noch 3 Plätze");
assert.equal(itemHint(20, 19)?.text, "Nur noch 1 Platz");
assert.equal(itemHint(20, 5, "Bestseller")?.text, "Bestseller");
assert.equal(itemHint(null, 99), null);

// QR references are valid for both IBAN kinds
assert.ok(isSCORReferenceValid(paymentReference("CH9300762011623852957", 42)));
assert.ok(isQRReferenceValid(paymentReference("CH4431999123000889012", 42)));

assert.deepEqual(parseAddress("Tennisclub, Route de Fribourg 12, 1723 Marly"), { address: "Route de Fribourg", buildingNumber: "12", zip: "1723", city: "Marly" });
assert.equal(parseAddress("Marly"), null);

// campaign: send, remind after 14 days (max 2), task after 35 days
const camp = { reminderDays: 14, taskDays: 35 };
const t0 = new Date("2026-11-01T07:00:00Z");
const at = (d: number) => new Date(t0.getTime() + d * DAY);
assert.equal(campaignStep({ status: "REQUESTED", sentAt: null, remindedAt: null, reminders: 0 }, camp, t0, false), "send");
assert.equal(campaignStep({ status: "REQUESTED", sentAt: t0, remindedAt: null, reminders: 0 }, camp, at(13), false), null);
assert.equal(campaignStep({ status: "REQUESTED", sentAt: t0, remindedAt: null, reminders: 0 }, camp, at(14), false), "remind");
assert.equal(campaignStep({ status: "REMINDED", sentAt: t0, remindedAt: at(14), reminders: 1 }, camp, at(28), false), "remind");
assert.equal(campaignStep({ status: "REMINDED", sentAt: t0, remindedAt: at(28), reminders: 2 }, camp, at(34), false), null);
assert.equal(campaignStep({ status: "REMINDED", sentAt: t0, remindedAt: at(28), reminders: 2 }, camp, at(35), false), "task");
assert.equal(campaignStep({ status: "REMINDED", sentAt: t0, remindedAt: at(28), reminders: 2 }, camp, at(40), true), null);
assert.equal(campaignStep({ status: "CONFIRMED", sentAt: t0, remindedAt: null, reminders: 0 }, camp, at(99), false), null);

// dunning: due + 10 days → 1st reminder, +14 → 2nd, +14 → task
const due = new Date("2026-12-01T00:00:00Z");
const inv = (lvl: number, dunned: Date | null, paid: Date | null = null) => ({ dueAt: due, paidAt: paid, dunningLevel: lvl, dunnedAt: dunned });
assert.equal(dunningStep(inv(0, null), new Date(due.getTime() + 9 * DAY)), null);
assert.equal(dunningStep(inv(0, null), new Date(due.getTime() + 10 * DAY)), 1);
assert.equal(dunningStep(inv(1, new Date(due.getTime() + 10 * DAY)), new Date(due.getTime() + 24 * DAY)), 2);
assert.equal(dunningStep(inv(2, new Date(due.getTime() + 24 * DAY)), new Date(due.getTime() + 38 * DAY)), 3);
assert.equal(dunningStep(inv(3, new Date(due.getTime() + 38 * DAY)), new Date(due.getTime() + 99 * DAY)), null);
assert.equal(dunningStep(inv(0, null, due), new Date(due.getTime() + 99 * DAY)), null);

assert.equal(renewalRate(new Set(["a", "b", "c", "d"]), new Set(["a", "b", "c", "x"])), 0.75);
assert.equal(renewalRate(new Set(), new Set(["a"])), null);

// Excel import
assert.equal(parseAmount("1'500.–"), 1500);
assert.equal(parseAmount("CHF 2 400,50"), 2400.5);
const { rows, errors } = parseSponsors(
  [
    "Firma;Ansprechpartner;E-Mail;Strasse;PLZ Ort;Verantwortlich;Leistung;Betrag 2026",
    "Garage Muster AG;Hans Muster;HANS@muster.ch;Hauptstrasse 1;1723 Marly;Anna Vorstand;Blache, Tischset;1'200.-",
    ";ohne Firma;x@y.ch",
    "Garage Muster AG;doppelt",
    "Bäckerei Beck;Eva Beck;kein-mail;;;;;",
  ].join("\n"),
);
assert.equal(rows.length, 2);
assert.deepEqual(rows[0], {
  name: "Garage Muster AG", contact: "Hans Muster", email: "hans@muster.ch", street: "Hauptstrasse 1", zip: "1723", city: "Marly",
  owner: "Anna Vorstand", items: ["Blache", "Tischset"], amount: 1200,
});
assert.equal(rows[1].email, undefined);
assert.deepEqual(errors.map((e) => e.line), [3, 4, 5]);
assert.equal(parseSponsors("Name;Mail\n").errors.length, 0);
assert.equal(parseSponsors("foo;bar\nx;y").errors[0].reason, "Kopfzeile mit Spalte «Firma» fehlt");

// add-ons (owner 2026-10-07): bought later, run until the contract ends with its discount, full yearly price;
// Stripe checkout holds the place but isn't confirmed or billed until paid
{
  const now = new Date("2027-05-10T10:00:00Z");
  const c = {
    startYear: 2027, years: 2, discountPct: 10, lines: [
      { id: "main", quantity: 1, unitPrice: 1000, fromYear: null, pendingUntil: null },
      { id: "addon", quantity: 2, unitPrice: 500, fromYear: 2027, pendingUntil: null },
      { id: "late", quantity: 1, unitPrice: 300, fromYear: 2028, pendingUntil: null },
      { id: "paying", quantity: 1, unitPrice: 400, fromYear: 2027, pendingUntil: new Date(now.getTime() + 60_000) },
    ],
  };
  assert.deepEqual(confirmedLines(c, 2027).map((l) => l.id), ["main", "addon"]);
  assert.deepEqual(confirmedLines(c, 2028).map((l) => l.id), ["main", "addon", "late"]);
  assert.equal(contractAmount(c, 2027), 1800); // (1000 + 2×500) −10 %
  assert.equal(contractAmount(c, 2028), 2070);
  assert.equal(hasYear(c, 2029), false);
  assert.equal(holdsPlace(c, c.lines[3], 2027, now), true); // checkout running → place held
  assert.equal(holdsPlace(c, c.lines[3], 2027, new Date(now.getTime() + 120_000)), false); // expired → free again
  // yearly invoice covered "main"; the add-on gets its own invoice
  assert.deepEqual(unbilledLines(c, 2027, [{ lines: [{ lineId: "main" }] }]).map((l) => l.id), ["addon"]);
  assert.deepEqual(unbilledLines(c, 2028, []).map((l) => l.id), ["main", "addon", "late"]);
  assert.deepEqual(unbilledLines(c, 2027, [{ lines: null }]), []); // old invoice without snapshot covers everything
}

// CRM: contract 2026 for 2 years ends 31.12.2027; renewal reminder from 60 days before; cancelled never
{
  const k = { startYear: 2026, years: 2 };
  assert.equal(contractEnd(k)?.toISOString().slice(0, 10), "2027-12-31");
  assert.equal(contractEnd({ ...k, cancelledAt: new Date() }), null);
  assert.equal(renewalReminderDue(k, new Date("2027-11-01T10:00:00+01:00")), true);
  assert.equal(renewalReminderDue(k, new Date("2027-10-01T10:00:00+02:00")), false);
  assert.equal(renewalReminderDue({ ...k, cancelledAt: new Date() }, new Date("2027-12-01T10:00:00+01:00")), false);
}

// CRM: follow-up due today (Zurich), not tomorrow, never when done
{
  const now = new Date("2026-10-08T15:00:00+02:00");
  assert.equal(followUpDue({ followUpAt: new Date("2026-10-08T00:00:00+02:00"), followUpDoneAt: null }, now), true);
  assert.equal(followUpDue({ followUpAt: new Date("2026-10-09T00:00:00+02:00"), followUpDoneAt: null }, now), false);
  assert.equal(followUpDue({ followUpAt: new Date("2026-10-08T00:00:00+02:00"), followUpDoneAt: now }, now), false);
  assert.equal(followUpDue({ followUpAt: null, followUpDoneAt: null }, now), false);
}

// CRM: placeholders; without first name the placeholder and its leading space disappear
assert.equal(fillPlaceholders("Guten Tag {Vorname}, {Firma} dankt.", { firma: "Muster AG", vorname: "Anna" }), "Guten Tag Anna, Muster AG dankt.");
assert.equal(fillPlaceholders("Guten Tag {Vorname}, {Firma} dankt.", { firma: "Muster AG" }), "Guten Tag, Muster AG dankt.");
assert.deepEqual(STAGES.map((x) => x.label), ["Interessiert", "Angebot", "Verhandlung", "Zugesagt", "Abgesagt"]);
assert.equal(MAIL_TEMPLATES.length, 4);

console.log("sponsoring ok");
