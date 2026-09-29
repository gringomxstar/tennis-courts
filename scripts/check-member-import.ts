import assert from "node:assert/strict";
import { parseMembers } from "../src/lib/member-import";

// Excel paste (tabs), header in custom order, BOM, blank line, CRLF
let r = parseMembers("﻿E-Mail\tNachname\tVorname\tTel.\r\nHANS@Example.ch \tMuster\tHans\t079 123 45 67\r\n\r\nanna@x.ch\tBeispiel\tAnna\t\r\n");
assert.deepEqual(r.errors, []);
assert.deepEqual(r.rows, [
  { firstName: "Hans", lastName: "Muster", email: "hans@example.ch", phone: "079 123 45 67" },
  { firstName: "Anna", lastName: "Beispiel", email: "anna@x.ch" },
]);

// no header: Vorname, Nachname, E-Mail, Telefon; semicolon; quotes
r = parseMembers('"Hans";"Muster";"hans@x.ch";"+41 79 1"\nAnna;Beispiel;anna@x.ch');
assert.equal(r.rows.length, 2);
assert.deepEqual(r.rows[0], { firstName: "Hans", lastName: "Muster", email: "hans@x.ch", phone: "+41 79 1" });

// comma CSV, single Name column split on last space, quoted comma
r = parseMembers('Name,Email\nMaria de la Cruz,maria@x.ch\n"Solo",solo@x.ch\n"Doe, Jane",jane@x.ch');
assert.deepEqual(r.rows[0], { firstName: "Maria de la", lastName: "Cruz", email: "maria@x.ch" });
assert.deepEqual(r.rows[1], { firstName: "Solo", lastName: "", email: "solo@x.ch" });
assert.equal(r.rows[2].firstName, "Doe,");

// errors: invalid, missing, duplicate (case-insensitive), missing first name; line numbers
r = parseMembers("Vorname;Nachname;E-Mail\nA;B;kaputt\nC;D;\nE;F;e@x.ch\nG;H;E@X.CH\n;I;i@x.ch");
assert.deepEqual(r.rows.map((x) => x.email), ["e@x.ch"]);
assert.deepEqual(r.errors, [
  { line: 2, reason: "E-Mail ungültig" },
  { line: 3, reason: "E-Mail fehlt" },
  { line: 5, reason: "E-Mail doppelt (Zeile 4)" },
  { line: 6, reason: "Vorname fehlt" },
]);

assert.deepEqual(parseMembers("  \n\n"), { rows: [], errors: [] });
console.log("member import ok");
