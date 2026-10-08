// Pure sponsoring rules (no DB): discounts, contract years, availability, QR references, campaign and dunning steps.
// Checked by scripts/check-sponsoring.ts.
import { calculateQRReferenceChecksum, calculateSCORReferenceChecksum, isQRIBAN } from "swissqrbill/utils";

/** Contract length → discount in percent (owner: 2 years −10 %, 3 years −15 %). */
export const DISCOUNT: Record<number, number> = { 1: 0, 2: 10, 3: 15 };

export type Line = { quantity: number; unitPrice: number };
export type ContractLike = { startYear: number; years: number; cancelledAt?: Date | null };

export const coversYear = (c: ContractLike, year: number) => !c.cancelledAt && c.startYear <= year && year < c.startYear + c.years;

/** A contract line: bought with the contract or later as add-on (fromYear), possibly still in Stripe checkout (pendingUntil). */
export type LineLike = { id?: string; quantity: number; unitPrice: number | { toString(): string }; fromYear?: number | null; pendingUntil?: Date | null };

/** Line runs in that year: inside the contract term and not before its add-on year. */
export const lineInYear = (c: ContractLike, l: Pick<LineLike, "fromYear">, year: number) => coversYear(c, year) && (l.fromYear ?? c.startYear) <= year;

/** Confirmed (paid or on invoice) lines of a year; a running Stripe checkout doesn't count yet. */
export const confirmedLines = <L extends LineLike>(c: ContractLike & { lines: L[] }, year: number) =>
  c.lines.filter((l) => !l.pendingUntil && lineInYear(c, l, year));

/** Sponsor is on board in that year (status "zugesagt"). */
export const hasYear = (c: ContractLike & { lines: LineLike[] }, year: number) => confirmedLines(c, year).length > 0;

/** Place taken in that year: confirmed, or reserved by a checkout that hasn't run out. */
export const holdsPlace = (c: ContractLike, l: Pick<LineLike, "fromYear" | "pendingUntil">, year: number, now: Date) => lineInYear(c, l, year) && (!l.pendingUntil || l.pendingUntil > now);

/** Yearly amount of a contract (all confirmed lines of that year, contract discount). */
export const contractAmount = (c: ContractLike & { discountPct: number; lines: LineLike[] }, year: number) =>
  yearlyAmount(confirmedLines(c, year).map((l) => ({ quantity: l.quantity, unitPrice: Number(l.unitPrice) })), c.discountPct);

/** Lines of a year that no invoice of that year covers yet. Old invoices without snapshot cover every line. */
export function unbilledLines<L extends LineLike & { id: string }>(c: ContractLike & { lines: L[] }, year: number, invoices: { lines: unknown }[]) {
  if (invoices.some((i) => i.lines == null)) return [];
  const billed = new Set(invoices.flatMap((i) => (i.lines as { lineId: string }[]).map((x) => x.lineId)));
  return confirmedLines(c, year).filter((l) => !billed.has(l.id));
}

/** Amount billed per contract year, rounded to 5 Rappen. */
export function yearlyAmount(lines: Line[], discountPct: number) {
  const gross = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  return Math.round((gross * (100 - discountPct)) / 100 / 0.05) * 0.05;
}

/** Free places of an item in a year; null = unlimited. */
export function freePlaces(capacity: number | null, taken: number) {
  return capacity == null ? null : Math.max(0, capacity - taken);
}

/** Portal hint: "Bereits vergeben", "Nur noch 3 Plätze" or the item's own badge ("Bestseller"). */
export function itemHint(capacity: number | null, taken: number, badge?: string | null): { text: string; tone: "sold" | "low" | "badge" } | null {
  const free = freePlaces(capacity, taken);
  if (free === 0) return { text: "Bereits vergeben", tone: "sold" };
  if (free != null && free <= 3 && capacity! > 1) return { text: free === 1 ? "Nur noch 1 Platz" : `Nur noch ${free} Plätze`, tone: "low" };
  return badge ? { text: badge, tone: "badge" } : null;
}

/** Structured payment reference: QR reference for a QR-IBAN, otherwise creditor reference (RF…). */
export function paymentReference(iban: string, invoiceNumber: number) {
  if (isQRIBAN(iban)) {
    const body = String(invoiceNumber).padStart(26, "0");
    return body + calculateQRReferenceChecksum(body);
  }
  const body = String(invoiceNumber);
  return `RF${calculateSCORReferenceChecksum(body)}${body}`;
}

/** "Route de Fribourg 12, 1723 Marly" → structured address for the QR bill; null if no "PLZ Ort" part. */
export function parseAddress(text: string | null | undefined) {
  const parts = (text ?? "").split(/,|\n/).map((s) => s.trim()).filter(Boolean);
  const zi = parts.findIndex((p) => /^(CH-)?\d{4}\s+\S/.test(p));
  if (zi < 0) return null;
  const [, zip, city] = parts[zi].match(/^(?:CH-)?(\d{4})\s+(.+)$/)!;
  const streetPart = parts.slice(0, zi).at(-1) ?? "";
  const m = streetPart.match(/^(.*?)\s+(\d+\s?[a-zA-Z]?)$/);
  return { address: m ? m[1] : streetPart, buildingNumber: m ? m[2] : undefined, zip, city };
}

export const DAY = 86_400_000;

export type RequestState = { status: "REQUESTED" | "REMINDED" | "CONFIRMED" | "DECLINED"; sentAt: Date | null; remindedAt: Date | null; reminders: number };

/** What the daily campaign run does for one request: send the first mail, remind (max 2×), or hand over to the board member. */
export function campaignStep(r: RequestState, c: { reminderDays: number; taskDays: number }, now: Date, hasTask: boolean): "send" | "remind" | "task" | null {
  if (r.status === "CONFIRMED" || r.status === "DECLINED") return null;
  if (!r.sentAt) return "send";
  const since = now.getTime() - r.sentAt.getTime();
  if (since >= c.taskDays * DAY) return hasTask ? null : "task";
  const last = (r.remindedAt ?? r.sentAt).getTime();
  if (r.reminders < 2 && now.getTime() - last >= c.reminderDays * DAY) return "remind";
  return null;
}

/** Payment terms and dunning: due after 30 days, 1st reminder 10 days after due, 2nd 14 days later, then a task. */
export const PAYMENT_DAYS = 30;
export function dunningStep(inv: { dueAt: Date; paidAt: Date | null; dunningLevel: number; dunnedAt: Date | null }, now: Date): 1 | 2 | 3 | null {
  if (inv.paidAt) return null;
  const t = now.getTime();
  if (inv.dunningLevel === 0) return t >= inv.dueAt.getTime() + 10 * DAY ? 1 : null;
  if (inv.dunningLevel < 3 && inv.dunnedAt && t >= inv.dunnedAt.getTime() + 14 * DAY) return (inv.dunningLevel + 1) as 2 | 3;
  return null;
}

/** Share of last year's sponsors who are on board again this year (null if there were none). */
export function renewalRate(prev: Set<string>, cur: Set<string>) {
  if (!prev.size) return null;
  let kept = 0;
  for (const id of prev) if (cur.has(id)) kept++;
  return kept / prev.size;
}

export const chf = (n: number) => `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- CRM ----------

export const STAGES = [
  { value: "INTERESTED", label: "Interessiert" },
  { value: "OFFER", label: "Angebot" },
  { value: "NEGOTIATION", label: "Verhandlung" },
  { value: "WON", label: "Zugesagt" },
  { value: "LOST", label: "Abgesagt" },
] as const;
export type Stage = (typeof STAGES)[number]["value"];

/** Calendar day in Europe/Zurich as UTC midnight, so day differences are DST-proof. */
const zurichDay = (d: Date) => Date.parse(d.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" }));

/** Follow-up is due once its day (Europe/Zurich) is today or past, unless done. */
export const followUpDue = (n: { followUpAt: Date | null; followUpDoneAt: Date | null }, now: Date) =>
  Boolean(n.followUpAt) && !n.followUpDoneAt && zurichDay(n.followUpAt!) <= zurichDay(now);

/** 31 December of the contract's last year; null if cancelled. */
export const contractEnd = (c: ContractLike) => (c.cancelledAt ? null : new Date(Date.UTC(c.startYear + c.years - 1, 11, 31)));

/** From `days` days before the contract ends (never for cancelled contracts). */
export function renewalReminderDue(c: ContractLike, now: Date, days = 60) {
  const end = contractEnd(c);
  return end != null && end.getTime() - zurichDay(now) <= days * DAY;
}

/** Replaces {Firma} and {Vorname}; without first name the placeholder and one space before it go. */
export const fillPlaceholders = (text: string, v: { firma: string; vorname?: string | null }) =>
  text.replace(/ ?\{Vorname\}/g, (m) => (v.vorname ? (m.startsWith(" ") ? " " : "") + v.vorname : "")).replaceAll("{Firma}", v.firma);

export const MAIL_TEMPLATES = [
  { id: "leer", label: "Leer", subject: "", body: "" },
  {
    id: "verlaengerung", label: "Verlängerung", subject: "Ihr Sponsoring: Verlängerung",
    body: "Guten Tag {Vorname}\n\nIhr Sponsoring-Vertrag für {Firma} läuft demnächst aus. Wir würden uns freuen, wenn Sie uns weiterhin unterstützen. Gerne besprechen wir mit Ihnen die Verlängerung.\n\nFreundliche Grüsse",
  },
  {
    id: "dank", label: "Dank", subject: "Herzlichen Dank für Ihre Unterstützung",
    body: "Guten Tag {Vorname}\n\nHerzlichen Dank, dass {Firma} unseren Club unterstützt. Ihr Engagement ist für uns sehr wertvoll.\n\nFreundliche Grüsse",
  },
  {
    id: "apero", label: "Einladung Apéro", subject: "Einladung zum Sponsoren-Apéro",
    body: "Guten Tag {Vorname}\n\nWir laden Sie und {Firma} herzlich zu unserem Sponsoren-Apéro ein. Datum und Ort: [bitte ergänzen]. Bitte melden Sie sich kurz an.\n\nFreundliche Grüsse",
  },
] as const;
