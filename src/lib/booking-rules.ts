import type { LimitRole, SportType, TenantRole, TenantSettings } from "@/types";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export const LIMIT_ROLES: [LimitRole, string][] = [
  ["MEMBER", "Mitglied"],
  ["COACH", "Trainer"],
  ["GUEST", "Gast (mit Konto)"],
];
export const SPORTS: [SportType, string][] = [
  ["TENNIS", "Tennis"],
  ["PADEL", "Padel"],
];

export interface PlanRules {
  bookingWindowDays: number;
  allowedDurations: number[];
  simultaneousBookingLimit: number;
  dailyBookingLimit?: number;
  guestsPerWeek?: number | null;
  sports?: SportType[];
  playWindow?: { weekdays: number[]; fromHour: number; toHour: number } | null;
}

const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const zurich = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" });
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
/** Weekday (0 = Sunday) and fractional hour in club time. */
function clubTime(d: Date) {
  const p = Object.fromEntries(zurich.formatToParts(d).map((x) => [x.type, x.value]));
  return { day: WEEKDAY[p.weekday], hour: Number(p.hour) + Number(p.minute) / 60 };
}

/** "Mo–Fr 8–16 Uhr" */
export function playWindowLabel(w: { weekdays: number[]; fromHour: number; toHour: number }) {
  const days = [...w.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const contiguous = days.every((d, i) => i === 0 || (days[i - 1] + 1) % 7 === d);
  const d = contiguous && days.length > 2 ? `${WD_SHORT[days[0]]}–${WD_SHORT[days[days.length - 1]]}` : days.map((x) => WD_SHORT[x]).join(", ");
  return `${d} ${w.fromHour}–${w.toHour} Uhr`;
}

/** One of the user's non-cancelled bookings (organized or played in). */
export interface OwnBooking {
  startsAt: string;
  endsAt: string;
  sport: SportType;
  /** GUEST participants, only counted where the user is the organizer. */
  guestCount: number;
}

export interface RuleInput {
  settings: TenantSettings | null | undefined;
  role: TenantRole;
  plan: PlanRules | null;
  sport: SportType;
  start: Date;
  end: Date;
  isDouble: boolean;
  guestCount: number;
  mine: OwnBooking[];
  now?: number;
}

/** Active-slot limit for a role and sport; Infinity = unlimited. */
export function slotLimitFor(settings: TenantSettings | null | undefined, role: TenantRole, sport: SportType): number {
  const row = settings?.slotLimits?.[role as LimitRole];
  if (row) return row[sport] ?? Infinity;
  return settings?.marlyRuleEnabled ? (settings.maxActiveSlotsPerPlayer ?? 2) : Infinity;
}

/** Monday 00:00 UTC of the week containing t. */
// ponytail: UTC week, can be off by the Zurich offset around Sunday midnight; use tenant tz if it matters
const weekStart = (t: number) => {
  const d = new Date(t);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY;
};

/** Error message for the first broken rule, or null when the booking is allowed. Club admins skip this. */
export function checkBookingRules(i: RuleInput): string | null {
  const now = i.now ?? Date.now();
  const s = i.start.getTime();
  const e = i.end.getTime();
  const minutes = (e - s) / 60_000;
  const active = i.mine.filter((b) => new Date(b.endsAt).getTime() > now);

  if (i.plan) {
    if (s - now > i.plan.bookingWindowDays * DAY) {
      return `Mit deinem Abo kannst du höchstens ${i.plan.bookingWindowDays} Tage im Voraus buchen.`;
    }
    const w = i.plan.playWindow;
    if (w && (i.plan.sports ?? ["TENNIS"]).includes(i.sport)) {
      const a = clubTime(i.start);
      const b = clubTime(new Date(e - 60_000));
      const inside = (t: { day: number; hour: number }) => w.weekdays.includes(t.day) && t.hour >= w.fromHour && t.hour < w.toHour;
      if (!inside(a) || !inside(b)) return `Dein Abo gilt nur ${playWindowLabel(w)}.`;
    }
    const d = i.plan.allowedDurations;
    // a 2h double is two 60-min slots, governed by the club's doubles rule
    const ok = !d.length || d.includes(minutes) || (minutes === 120 && i.isDouble && d.includes(60));
    if (!ok) return `Dein Abo erlaubt nur Buchungen von ${d.join(" oder ")} Minuten.`;
    if (active.length >= i.plan.simultaneousBookingLimit) {
      return `Dein Abo erlaubt höchstens ${i.plan.simultaneousBookingLimit} aktive Buchungen gleichzeitig.`;
    }
    const day = new Date(s).setUTCHours(0, 0, 0, 0);
    const sameDay = i.mine.filter((b) => new Date(b.startsAt).setUTCHours(0, 0, 0, 0) === day).length;
    if (i.plan.dailyBookingLimit != null && sameDay >= i.plan.dailyBookingLimit) {
      return `Dein Abo erlaubt höchstens ${i.plan.dailyBookingLimit} Buchung${i.plan.dailyBookingLimit === 1 ? "" : "en"} pro Tag.`;
    }
    if (i.guestCount > 0 && i.plan.guestsPerWeek != null) {
      const w = weekStart(s);
      const used = i.mine
        .filter((b) => {
          const t = new Date(b.startsAt).getTime();
          return t >= w && t < w + WEEK;
        })
        .reduce((n, b) => n + b.guestCount, 0);
      if (used + i.guestCount > i.plan.guestsPerWeek) {
        return `Dein Abo erlaubt höchstens ${i.plan.guestsPerWeek} Gäste pro Woche (bereits ${used}).`;
      }
    }
  }

  const limit = slotLimitFor(i.settings, i.role, i.sport);
  if (active.filter((b) => b.sport === i.sport).length >= limit) {
    return `Buchungskontingent erschöpft: Maximal ${limit} aktive ${i.sport === "PADEL" ? "Padel-" : ""}Reservierungen gleichzeitig. Ein neuer Slot wird frei, sobald dein nächstes Spiel beendet ist.`;
  }

  // Marly anti-blocking: coaches teach back-to-back lessons, so they're exempt
  if (i.settings?.marlyRuleEnabled && i.role !== "COACH" && !i.isDouble) {
    if (active.some((b) => new Date(b.endsAt).getTime() === s || new Date(b.startsAt).getTime() === e)) {
      return "Direkt aufeinanderfolgende Buchungen (2 Stunden am Stück) sind im Einzel nicht gestattet. Eine 2-stündige Reservierung ist exklusiv für 4er-Doppel reserviert.";
    }
    const cooldown = (i.settings.marlyCooldownMinutes ?? 60) * 60_000;
    const tooClose = active.some((b) => {
      const bs = new Date(b.startsAt).getTime();
      const be = new Date(b.endsAt).getTime();
      return (s >= be && s - be < cooldown) || (bs >= e && bs - e < cooldown);
    });
    if (cooldown > 0 && tooClose) {
      return `Fairplay-Regel: Zwischen deinen Spielen ist eine Pause von mindestens ${i.settings.marlyCooldownMinutes ?? 60} Minuten vorgeschrieben.`;
    }
  }
  return null;
}

/** First ball-machine booking overlapping [start, end), if any. */
export function ballMachineConflict<T extends { startsAt: string; endsAt: string; hasBallMachine?: boolean; status: string; id: string }>(
  bookings: T[],
  start: Date,
  end: Date,
  excludeId?: string
): T | undefined {
  return bookings.find(
    (b) =>
      b.hasBallMachine &&
      b.status !== "CANCELLED" &&
      b.id !== excludeId &&
      start.getTime() < new Date(b.endsAt).getTime() &&
      end.getTime() > new Date(b.startsAt).getTime()
  );
}

/** Latest allowed start for a booking made now (late booking into a running slot). */
export const lateBookingCutoff = (settings: TenantSettings | null | undefined, now = Date.now()) =>
  now - (settings?.lateBookingMinutes ?? 15) * 60_000;
