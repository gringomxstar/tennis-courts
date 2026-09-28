import type { Booking, Court, CourtBlock } from "@/types";

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

/** "Platz 3 (Sand - Center)" -> { name: "Platz 3", sub: "Sand · Center" } */
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
  const booking = bookings.find(
    (b) => b.courtId === courtId && b.status !== "CANCELLED" && overlaps(s, e, b.startsAt, b.endsAt)
  );
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
