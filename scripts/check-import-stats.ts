import assert from "node:assert";
import { parseMembers, parseDate, parseGender } from "../src/lib/member-import";
const csv = "﻿Kontakt-ID;Anrede;Vorname;Name;Geburtsdatum;Geschlecht;E-Mail (primär);Telefon (Mobile)\n1;Frau;Anna;Muster;03.04.2012;weiblich;anna@x.ch;079 1\n2;Herr;Beat;Keller;1970-01-31;männlich;BEAT@x.ch;\n3;;Cleo;Z;99.99.2000;?;cleo@x.ch;";
const { rows, errors } = parseMembers(csv);
assert.equal(errors.length, 0);
assert.deepEqual(rows[0], { firstName: "Anna", lastName: "Muster", email: "anna@x.ch", phone: "079 1", birthDate: "2012-04-03", gender: "F" });
assert.equal(rows[1].gender, "M"); assert.equal(rows[1].birthDate, "1970-01-31"); assert.equal(rows[1].email, "beat@x.ch");
assert.equal(rows[2].birthDate, undefined); assert.equal(rows[2].gender, undefined);
assert.equal(parseDate("31.02.2000"), undefined); assert.equal(parseDate("1.2.85"), "1985-02-01");
assert.equal(parseGender("Male"), "M"); assert.equal(parseGender("F"), "F");
console.log("ok");

// stats helpers
import { ageClass, local, toCsv } from "../src/lib/stats";
assert.equal(ageClass(new Date("2014-06-01"), 2026), "U14");
assert.equal(ageClass(new Date("2008-01-01"), 2026), "U18");
assert.equal(ageClass(null, 2026), "unbekannt");
assert.deepEqual(local(new Date("2026-07-05T21:30:00Z")), { y: 2026, m: 7, wd: 6, h: 23, date: "2026-07-05" }); // Sunday 23:30 CEST
assert.equal(toCsv([["a;b", "=cmd", -5, 'x"y']]), '﻿"a;b";\'=cmd;-5;"x""y"\r\n');
console.log("stats ok");

import { cancelDeadlineMinutes, deadlineText } from "../src/lib/booking-rules";
assert.equal(cancelDeadlineMinutes({ cancellationDeadlineHours: 24 }), 1440);
assert.equal(cancelDeadlineMinutes({ cancellationDeadlineHours: 24, cancellationDeadlineMinutes: 1 }), 1);
assert.equal(cancelDeadlineMinutes(null), 1440);
assert.equal(deadlineText(1), "1 Minute"); assert.equal(deadlineText(120), "2 Stunden"); assert.equal(deadlineText(90), "90 Minuten");
console.log("deadline ok");
