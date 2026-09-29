import type { Court, PaymentMethod, PriceRule, SportType, TenantSettings } from "@/types";

/** Hour (local) from which floodlight is charged on lit courts. */
export const FLOODLIGHT_FROM_HOUR = 19;

export function needsFloodlight(court: Pick<Court, "hasLighting">, startHour: number): boolean {
  return court.hasLighting && startHour >= FLOODLIGHT_FROM_HOUR;
}

export interface BookingCostInput {
  settings: TenantSettings | null | undefined;
  court: Pick<Court, "sportType" | "isIndoor" | "hourlyRate">;
  isGuest: boolean;
  /** Sports of the member's active Abo; null = no Abo (plain MEMBER: outdoor tennis free, padel paid). */
  planSports?: SportType[] | null;
  durationMinutes: number;
  guestCount: number;
  hasBallMachine: boolean;
  hasLighting: boolean;
  /** Needed for price rules (time of day, weekday, lead time). */
  start?: Date;
  now?: number;
}

export interface BookingCost {
  court: number;
  guests: number;
  ballMachine: number;
  lighting: number;
  total: number;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const zurich = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", hour: "numeric", hourCycle: "h23", weekday: "short" });

/** Price rules whose conditions all match this start time, in club time (same result on server and browser). */
export function matchingPriceRules(rules: PriceRule[] | undefined, start: Date, now = Date.now()): PriceRule[] {
  if (!rules?.length) return [];
  const lead = (start.getTime() - now) / 3_600_000;
  const parts = Object.fromEntries(zurich.formatToParts(start).map((p) => [p.type, p.value]));
  const h = Number(parts.hour);
  const day = WEEKDAY[parts.weekday];
  return rules.filter(
    (r) =>
      (!r.weekdays?.length || r.weekdays.includes(day)) &&
      (r.fromHour == null || h >= r.fromHour) &&
      (r.toHour == null || h < r.toHour) &&
      (r.minLeadHours == null || lead >= r.minLeadHours) &&
      (r.maxLeadHours == null || lead <= r.maxLeadHours)
  );
}

/** Anonymous visitors and logged-in GUEST accounts without an Abo pay the guest court rate. */
export const paysGuestRate = (loggedIn: boolean, role: string | null | undefined, hasPlan: boolean) =>
  !loggedIn || (role === "GUEST" && !hasPlan);

export const DINER_DEFAULT = { enabled: false, weekdays: [1, 2, 3, 4, 5], fromHour: 11, toHour: 13 };

/** Diner Tennis applies to this start (club time)? Only the start counts: 12:00–13:30 is still lunch. */
export function isDinerSlot(settings: TenantSettings | null | undefined, start: Date | undefined) {
  const d = settings?.dinerTennis;
  if (!d?.enabled || !start) return false;
  const p = Object.fromEntries(zurich.formatToParts(start).map((x) => [x.type, x.value]));
  const h = Number(p.hour);
  return d.weekdays.includes(WEEKDAY[p.weekday]) && h >= d.fromHour && h < d.toHour;
}

/** Single source of truth for booking prices (server action + client preview). */
export function computeBookingCost(i: BookingCostInput): BookingCost {
  const s = i.settings ?? undefined;
  const hours = i.durationMinutes / 60;
  let court = 0;
  const covered = !i.isGuest && Boolean(i.planSports?.includes(i.court.sportType));
  if (i.court.sportType === "PADEL") {
    if (!covered) court = (s?.defaultHourlyRatePadel ?? i.court.hourlyRate ?? 40) * hours;
  } else if (i.court.isIndoor) {
    court = (s?.defaultHourlyRateHalle ?? i.court.hourlyRate ?? 45) * hours;
  } else if (i.isGuest || (i.planSports && !covered)) {
    // a padel-only Abo doesn't include tennis
    court = (s?.defaultHourlyRateTennis ?? i.court.hourlyRate ?? 30) * hours;
  }
  if (court > 0 && i.start) {
    const pct = matchingPriceRules(s?.priceRules, i.start, i.now).reduce((n, r) => n + r.percent, 0);
    court = Math.max(0, Math.round(court * (1 + pct / 100) * 100) / 100);
  }
  // Diner Tennis: one guest free for members with an Abo
  const freeGuests = i.planSports && !i.isGuest && isDinerSlot(s, i.start) ? 1 : 0;
  // the guest fee is for members bringing a non-member; a guest-rate booking already pays the full court
  const guests = i.isGuest ? 0 : Math.max(0, i.guestCount - freeGuests) * (s?.guestFee ?? 15);
  const ballMachine = i.hasBallMachine ? (s?.ballMachineFee ?? 10) * hours : 0;
  const lighting = i.hasLighting ? (s?.floodlightFee ?? 0) : 0;
  return { court, guests, ballMachine, lighting, total: court + guests + ballMachine + lighting };
}

/** Payment choices shown before booking; the first one is the default. */
export function payOptions(
  settings: TenantSettings | null | undefined,
  o: { isAnon: boolean; wallet: number; total: number }
): [PaymentMethod, string][] {
  const opts: [PaymentMethod, string][] = [];
  if (!o.isAnon && o.wallet >= o.total) opts.push(["WALLET", "Guthaben"]);
  opts.push(["ONLINE", "Online"]);
  if (settings?.payOnSite) opts.push(["ON_SITE", "Vor Ort"]);
  if (!o.isAnon && settings?.payByInvoice) opts.push(["INVOICE", "Rechnung"]);
  return opts;
}

export function payButtonLabel(method: PaymentMethod, total: number) {
  if (method === "ONLINE") return `Bezahlen · CHF ${total}`;
  if (method === "WALLET") return `Buchen · CHF ${total} Guthaben`;
  return `Buchen · CHF ${total} ${method === "ON_SITE" ? "vor Ort" : "auf Rechnung"}`;
}
