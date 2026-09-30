import type { Court, PaymentMethod, PriceRule, SportType, TenantSettings } from "@/types";

/** Hour (local) from which floodlight is charged on lit courts. */
export const FLOODLIGHT_FROM_HOUR = 19;

/** Floodlight is due when a booking on a lit court runs past FLOODLIGHT_FROM_HOUR, in club time (server = browser). */
export function needsFloodlight(court: Pick<Court, "hasLighting">, start: Date, minutes: number): boolean {
  const p = Object.fromEntries(zurich.formatToParts(start).map((x) => [x.type, x.value]));
  return court.hasLighting && Number(p.hour) + Number(p.minute) / 60 + minutes / 60 > FLOODLIGHT_FROM_HOUR;
}

export interface BookingCostInput {
  settings: TenantSettings | null | undefined;
  court: Pick<Court, "sportType" | "isIndoor" | "hourlyRate">;
  /** Everyone on the court, booker first: the sports their running Abo covers (null = no Abo, e.g. a guest). */
  players: (SportType[] | null | undefined)[];
  durationMinutes: number;
  hasBallMachine: boolean;
  hasLighting: boolean;
  /** Needed for price rules (time of day, weekday, lead time). */
  start?: Date;
  now?: number;
}

export interface BookingCost {
  /** what the booker pays for the court: the shares of all players without an Abo */
  court: number;
  /** one player's share of the court */
  share: number;
  /** players whose share is paid */
  payers: number;
  ballMachine: number;
  lighting: number;
  total: number;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const zurich = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" });

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

export const DINER_DEFAULT = { enabled: false, weekdays: [1, 2, 3, 4, 5], fromHour: 11, toHour: 13 };

/** Diner Tennis applies to this start (club time)? Only the start counts: 12:00–13:30 is still lunch. */
export function isDinerSlot(settings: TenantSettings | null | undefined, start: Date | undefined) {
  const d = settings?.dinerTennis;
  if (!d?.enabled || !start) return false;
  const p = Object.fromEntries(zurich.formatToParts(start).map((x) => [x.type, x.value]));
  const h = Number(p.hour);
  return d.weekdays.includes(WEEKDAY[p.weekday]) && h >= d.fromHour && h < d.toHour;
}

/** Swiss cash rounding to 5 Rappen. */
export const roundRappen = (x: number) => Math.round(x * 20) / 20;

/**
 * Single source of truth for booking prices (server action + client preview).
 * The court price is split by the players; a running Abo covers its holder's share (outdoor, for its
 * sports); the booker alone pays the remaining shares. Ball machine and floodlight go to the booker.
 */
export function computeBookingCost(i: BookingCostInput): BookingCost {
  const s = i.settings ?? undefined;
  const hours = i.durationMinutes / 60;
  const rate =
    i.court.sportType === "PADEL"
      ? (s?.defaultHourlyRatePadel ?? i.court.hourlyRate ?? 40)
      : i.court.isIndoor
        ? (s?.defaultHourlyRateHalle ?? i.court.hourlyRate ?? 45)
        : (s?.defaultHourlyRateTennis ?? i.court.hourlyRate ?? 30);
  let full = rate * hours;
  if (i.start) {
    const pct = matchingPriceRules(s?.priceRules, i.start, i.now).reduce((n, r) => n + r.percent, 0);
    full = Math.max(0, full * (1 + pct / 100));
  }
  const players = i.players.length ? i.players : [null];
  const covered = (p: SportType[] | null | undefined) => aboCovers(i.court, p);
  let payers = players.filter((p) => !covered(p)).length;
  // Diner Tennis: an Abo holder brings one player free
  if (covered(players[0]) && payers > 0 && isDinerSlot(s, i.start)) payers--;
  const share = full / players.length;
  const court = roundRappen(share * payers);
  const ballMachine = i.hasBallMachine ? (s?.ballMachineFee ?? 10) * hours : 0;
  const lighting = i.hasLighting ? (s?.floodlightFee ?? 0) : 0;
  return { court, share: roundRappen(share), payers, ballMachine, lighting, total: roundRappen(court + ballMachine + lighting) };
}

/** Does an Abo for these sports cover its holder's share on this court? The hall is never part of an Abo. */
export function aboCovers(court: Pick<Court, "isIndoor" | "sportType">, sports: SportType[] | null | undefined) {
  return !court.isIndoor && Boolean(sports?.includes(court.sportType));
}

/**
 * Owner's rule (30.09.2026): the wallet pays automatically when it covers the whole total, otherwise
 * the full amount goes to Stripe Checkout and the wallet stays untouched. Never a split, never a choice.
 */
export function settleBooking(wallet: number, total: number) {
  return wallet >= total
    ? { method: "WALLET" as const, walletAfter: roundRappen(wallet - total), checkout: 0 }
    : { method: "ONLINE" as const, walletAfter: wallet, checkout: total };
}

/**
 * Payment options before booking. The first one is automatic (wallet or Stripe, see settleBooking);
 * more entries only when the club enabled "vor Ort" or "Rechnung".
 */
export function payOptions(
  settings: TenantSettings | null | undefined,
  o: { isAnon: boolean; wallet: number; total: number }
): [PaymentMethod, string][] {
  const auto = o.isAnon ? "ONLINE" : settleBooking(o.wallet, o.total).method;
  const opts: [PaymentMethod, string][] = [[auto, auto === "WALLET" ? "Guthaben" : "Online"]];
  if (settings?.payOnSite) opts.push(["ON_SITE", "Vor Ort"]);
  if (!o.isAnon && settings?.payByInvoice) opts.push(["INVOICE", "Rechnung"]);
  return opts;
}

export function payButtonLabel(method: PaymentMethod, total: number) {
  if (total <= 0) return "Reservieren";
  if (method === "ONLINE" || method === "WALLET") return `Bezahlen · CHF ${total}`;
  return `Reservieren · CHF ${total} ${method === "ON_SITE" ? "vor Ort" : "auf Rechnung"}`;
}
