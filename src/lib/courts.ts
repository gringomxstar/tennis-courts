import type { Booking, Court, CourtBlock, LimitRole, TenantSettings } from "@/types";

// design v3 booking types (docs/design/README.md)
export const BOOKING_COLORS: Record<LimitRole, string> = { MEMBER: "#38b58a", GUEST: "#f0a33a", COACH: "#7c5cff" };
export const BOOKING_ROLE_LABEL: Record<LimitRole, string> = { MEMBER: "Mitglied", GUEST: "Gast", COACH: "Trainer" };

/** Calendar color of a booking by its type; tournaments/events etc. use the member color. */
export function bookingColor(b: Pick<Booking, "bookingType"> | undefined, settings?: TenantSettings | null) {
  const role: LimitRole = b?.bookingType === "GUEST" ? "GUEST" : b?.bookingType === "COACH" ? "COACH" : "MEMBER";
  return settings?.bookingColors?.[role] ?? BOOKING_COLORS[role];
}

export type SurfaceKind = "clay" | "hard" | "padel";

export function surfaceKind(court: Pick<Court, "sportType" | "surface">): SurfaceKind {
  if (court.sportType === "PADEL") return "padel";
  return court.surface === "CLAY" ? "clay" : "hard";
}

export const SURFACE_COLOR: Record<SurfaceKind, string> = {
  clay: "var(--surface-clay)",
  hard: "var(--surface-hard)",
  padel: "var(--surface-padel)",
};

export const SURFACE_LABEL: Record<SurfaceKind, string> = {
  clay: "Sand",
  hard: "Allwetter",
  padel: "Padel",
};

/** "Platz 2 (Sand - Center)" -> { name: "Platz 2", sub: "Sand · Center" } */
export function courtLabel(court: Pick<Court, "name" | "sportType" | "surface">) {
  const m = court.name.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (m) return { name: m[1], sub: m[2].replace(/\s+-\s+/g, " · ").replace(/platz$/i, "") };
  return { name: court.name, sub: SURFACE_LABEL[surfaceKind(court)] };
}

export function courtColor(court: Pick<Court, "sportType" | "surface">) {
  return SURFACE_COLOR[surfaceKind(court)];
}

const overlaps = (aStart: number, aEnd: number, bStart: string, bEnd: string) =>
  aStart < new Date(bEnd).getTime() && aEnd > new Date(bStart).getTime();

export type SlotState = "free" | "mine" | "taken" | "blocked" | "past";

/** The live booking covering [start, start+minutes) on a court, if any. */
export function bookingAt(courtId: string, start: Date, minutes: number, bookings: Booking[]) {
  const s = start.getTime();
  const e = s + minutes * 60_000;
  return bookings.find((b) => b.courtId === courtId && b.status !== "CANCELLED" && overlaps(s, e, b.startsAt, b.endsAt));
}

const initial = (p: { firstName: string; lastName: string } | null | undefined) =>
  p?.firstName ? `${p.firstName} ${p.lastName ? `${p.lastName[0]}.` : ""}`.trim() : "";

/** "Max M. / Anna B. / …" — all players; empty when the viewer may not see names (see loadClubData). */
export function shortName(b: Booking) {
  if (b.bookingType === "COACH" && b.notes && !b.notes.startsWith("Training")) return b.notes; // Kursname statt Trainer
  const others = b.participants.filter((p) => p.role !== "ORGANIZER").map((p) => initial(p.user) || p.guestName || "");
  return [initial(b.organizer), ...others].filter(Boolean).join(" / ");
}

export function slotState(
  courtId: string,
  start: Date,
  minutes: number,
  bookings: Booking[],
  blocks: CourtBlock[],
  userId: string | undefined,
  now = Date.now()
): SlotState {
  const s = start.getTime();
  const e = s + minutes * 60_000;
  const booking = bookingAt(courtId, start, minutes, bookings);
  if (booking) {
    const mine =
      userId &&
      (booking.organizerId === userId || booking.participants.some((p) => p.userId === userId));
    return mine ? "mine" : "taken";
  }
  if (blocks.some((b) => b.courtId === courtId && overlaps(s, e, b.startsAt, b.endsAt))) return "blocked";
  if (s < now) return "past";
  return "free";
}

export function atHour(day: Date, hour: number) {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const WDL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export const hh = (h: number) => `${h < 10 ? "0" : ""}${h}:00`;
export const hhmm = (d: Date) => d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });

/** "Heute" / "Morgen" / weekday name, relative to today. */
export function relDay(d: Date) {
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - startOfToday().getTime()) / 86_400_000);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  return WDL[d.getDay()];
}

export const longDate = (d: Date) => `${WDL[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`;

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
