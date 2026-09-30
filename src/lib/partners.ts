import type { Booking, SportType, UserSummary } from "@/types";

export interface Person {
  id: string;
  name: string;
  plan?: string;
  /** sports the running Abo covers (price preview); null = no Abo */
  sports?: SportType[] | null;
}

/** Most frequent co-players from the user's bookings, topped up with other club members. */
export function frequentPartners(bookings: Booking[], userId: string, members: UserSummary[], n = 4): Person[] {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const ids = [b.organizerId, ...b.participants.map((p) => p.userId)].filter(
      (id): id is string => Boolean(id) && id !== userId
    );
    for (const id of new Set(ids)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const others = members.filter((m) => m.id !== userId && isPartner(m));
  const ranked = [...others].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  return ranked.slice(0, n).map(toPerson);
}

/** Club members plus registered guests (own password); guests booked by e-mail only stay out. */
export const isPartner = (m: UserSummary) => m.role !== "PLATFORM_ADMIN" && (m.role !== "GUEST" || Boolean(m.hasAccount));

export const toPerson = (m: UserSummary): Person => ({
  id: m.id,
  name: `${m.firstName} ${m.lastName}`.trim(),
  sports: m.planSports ?? null,
});
