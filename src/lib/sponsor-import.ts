import { splitLine } from "@/lib/member-import";

export interface SponsorImportRow {
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  street?: string;
  zip?: string;
  city?: string;
  website?: string;
  /** board member: name or e-mail */
  owner?: string;
  /** catalog item names, e.g. "Blache, Tischset" */
  items?: string[];
  amount?: number;
  year?: number;
  notes?: string;
}

type Col = keyof SponsorImportRow;

/** Header aliases of typical club sponsor lists (lower case, letters only). */
const HEADERS: [RegExp, Col][] = [
  [/^(firma|firmenname|sponsor|unternehmen|name|company)$/, "name"],
  [/mail/, "email"],
  [/telefon|^tel|mobil|natel|phone/, "phone"],
  [/kontakt|ansprech|vorname|nachname|person/, "contact"],
  [/strasse|adresse|address/, "street"],
  [/^(plz|postleitzahl|zip)$/, "zip"],
  [/^(ort|stadt|city|plzort|wohnort)$/, "city"],
  [/web|homepage|url/, "website"],
  [/verantwortlich|vorstand|betreu|zustaendig|zust.ndig|owner/, "owner"],
  [/leistung|paket|produkt|werbe|blache|katalog/, "items"],
  [/betrag|beitrag|preis|chf|summe|amount/, "amount"],
  [/^(jahr|saison|year)$/, "year"],
  [/notiz|bemerkung|kommentar|status|notes/, "notes"],
];

const headerCol = (cell: string): Col | undefined => {
  const k = cell.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^a-z]/g, "");
  return HEADERS.find(([re]) => re.test(k))?.[1];
};

/** "1'500.–", "CHF 1500", "1 500,00" → 1500 */
export function parseAmount(v: string): number | undefined {
  const s = v.replace(/CHF|Fr\.?|[’'\s]|\.?[–-]+$/gi, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "");
  const n = Number(s);
  return s && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parses pasted Excel cells, a CSV or a converted .xlsx sheet (tab separated). Needs a header row with "Firma". */
export function parseSponsors(text: string): { rows: SponsorImportRow[]; errors: { line: number; reason: string }[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n|\r/);
  const rows: SponsorImportRow[] = [];
  const errors: { line: number; reason: string }[] = [];
  const firstIdx = lines.findIndex((l) => l.trim());
  if (firstIdx < 0) return { rows, errors };
  const first = lines[firstIdx];
  const sep = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const cols = splitLine(first, sep).map(headerCol);
  if (!cols.includes("name")) return { rows, errors: [{ line: firstIdx + 1, reason: "Kopfzeile mit Spalte «Firma» fehlt" }] };
  const seen = new Map<string, number>();

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (i <= firstIdx || !raw.trim()) return;
    const v: Partial<Record<Col, string>> = {};
    splitLine(raw, sep).forEach((cell, j) => {
      const c = cols[j];
      if (c && cell) v[c] = v[c] ? `${v[c]} ${cell}` : cell; // "Vorname" + "Nachname" both land in contact
    });
    const name = v.name?.slice(0, 120);
    if (!name) return void errors.push({ line, reason: "Firma fehlt" });
    const key = name.toLowerCase();
    if (seen.has(key)) return void errors.push({ line, reason: `Firma doppelt (Zeile ${seen.get(key)})` });
    seen.set(key, line);
    const email = v.email?.toLowerCase();
    if (email && !EMAIL.test(email)) errors.push({ line, reason: "E-Mail ungültig, ohne E-Mail importiert" });
    // "1723 Marly" in one column
    let zip = v.zip, city = v.city;
    const zc = !zip && city?.match(/^(\d{4})\s+(.+)$/);
    if (zc) [zip, city] = [zc[1], zc[2]];
    const year = v.year ? Number(v.year.match(/\d{4}/)?.[0]) : undefined;
    rows.push({
      name,
      ...(v.contact ? { contact: v.contact.slice(0, 120) } : {}),
      ...(email && EMAIL.test(email) ? { email: email.slice(0, 200) } : {}),
      ...(v.phone ? { phone: v.phone.slice(0, 30) } : {}),
      ...(v.street ? { street: v.street.slice(0, 120) } : {}),
      ...(zip ? { zip: zip.slice(0, 10) } : {}),
      ...(city ? { city: city.slice(0, 60) } : {}),
      ...(v.website ? { website: v.website.slice(0, 200) } : {}),
      ...(v.owner ? { owner: v.owner.slice(0, 120) } : {}),
      ...(v.items ? { items: v.items.split(/[,;+\/]| und /).map((s) => s.trim()).filter(Boolean) } : {}),
      ...(v.amount && parseAmount(v.amount) != null ? { amount: parseAmount(v.amount) } : {}),
      ...(year && year > 2000 && year < 2100 ? { year } : {}),
      ...(v.notes ? { notes: v.notes.slice(0, 1000) } : {}),
    });
  });
  return { rows, errors };
}
