import type { Court, TenantSettings } from "@/types";

/** Hour (local) from which floodlight is charged on lit courts. */
export const FLOODLIGHT_FROM_HOUR = 19;

export function needsFloodlight(court: Pick<Court, "hasLighting">, startHour: number): boolean {
  return court.hasLighting && startHour >= FLOODLIGHT_FROM_HOUR;
}

export interface BookingCostInput {
  settings: TenantSettings | null | undefined;
  court: Pick<Court, "sportType" | "isIndoor" | "hourlyRate">;
  isGuest: boolean;
  durationMinutes: number;
  guestCount: number;
  hasBallMachine: boolean;
  hasLighting: boolean;
}

export interface BookingCost {
  court: number;
  guests: number;
  ballMachine: number;
  lighting: number;
  total: number;
}

/** Single source of truth for booking prices (server action + client preview). */
export function computeBookingCost(i: BookingCostInput): BookingCost {
  const s = i.settings ?? undefined;
  const hours = i.durationMinutes / 60;
  let court = 0;
  if (i.court.sportType === "PADEL") {
    court = (s?.defaultHourlyRatePadel ?? i.court.hourlyRate ?? 40) * hours;
  } else if (i.court.isIndoor) {
    court = (s?.defaultHourlyRateHalle ?? i.court.hourlyRate ?? 45) * hours;
  } else if (i.isGuest) {
    court = (s?.defaultHourlyRateTennis ?? i.court.hourlyRate ?? 30) * hours;
  }
  const guests = i.guestCount * (s?.guestFee ?? 15);
  const ballMachine = i.hasBallMachine ? (s?.ballMachineFee ?? 10) * hours : 0;
  const lighting = i.hasLighting ? (s?.floodlightFee ?? 5) : 0;
  return { court, guests, ballMachine, lighting, total: court + guests + ballMachine + lighting };
}
