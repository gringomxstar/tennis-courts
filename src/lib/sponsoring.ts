// Pure sponsoring rules (no DB): discounts, contract years, availability, QR references, campaign and dunning steps.
// Checked by scripts/check-sponsoring.ts.
import { calculateQRReferenceChecksum, calculateSCORReferenceChecksum, isQRIBAN } from "swissqrbill/utils";

/** Contract length → discount in percent (owner: 2 years −10 %, 3 years −15 %). */
export const DISCOUNT: Record<number, number> = { 1: 0, 2: 10, 3: 15 };

export type Line = { quantity: number; unitPrice: number };
export type ContractLike = { startYear: number; years: number; cancelledAt?: Date | null };

export const coversYear = (c: ContractLike, year: number) => !c.cancelledAt && c.startYear <= year && year < c.startYear + c.years;

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
