import { getTenantContext } from "@/lib/tenant";
import {
  getBlocksInRange,
  getBookingsInRange,
  getCourtsByTenantId,
  getTenantMembers,
  getUserBookings,
  getUserWallet,
  getMemberContext,
} from "@/lib/data";
import { syncPendingBookingPayments } from "@/lib/booking-payment";
import { frequentPartners, toPerson } from "@/lib/partners";
import { paysGuestRate } from "@/lib/pricing";
import type { Booking } from "@/types";

/** What the browser may see of other people's bookings: never emails, names only for club members. */
function publicBooking(b: Booking, showNames: boolean): Booking {
  const person = <T extends { firstName: string; lastName: string; email: string }>(p: T): T => ({
    ...p,
    email: "",
    firstName: showNames ? p.firstName : "",
    lastName: showNames ? p.lastName : "",
  });
  return {
    ...b,
    organizer: b.organizer && person(b.organizer),
    participants: b.participants.map((p) => ({
      ...p,
      guestEmail: null,
      guestName: showNames ? p.guestName : null,
      user: p.user && person(p.user),
    })),
  };
}

/** Everything the player screens need; the client derives local-time slots from the ISO data. */
export async function loadClubData(slug: string, days = 8) {
  const ctx = await getTenantContext(slug);
  const { tenant, user } = ctx;
  await syncPendingBookingPayments(tenant.id);

  // one day of slack either side covers any client timezone offset
  const from = new Date(Date.now() - 86_400_000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + (days + 2) * 86_400_000);

  const [courts, bookings, blocks, members, mine, wallet, member] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getBookingsInRange(tenant.id, from.toISOString(), to.toISOString()),
    getBlocksInRange(tenant.id, from.toISOString(), to.toISOString()),
    getTenantMembers(tenant.id),
    user ? getUserBookings(user.id, tenant.id) : Promise.resolve([]),
    user ? getUserWallet(tenant.id, user.id) : null,
    user ? getMemberContext(tenant.id, user.id) : null,
  ]);

  // DB role, not the JWT: a claimed guest account stays GUEST and sees no names
  const showNames = Boolean(member?.role && member.role !== "GUEST");
  return {
    ctx,
    tenant,
    user,
    courts: courts.filter((c) => c.status === "ACTIVE"),
    bookings: bookings.map((b) => publicBooking(b, showNames)),
    blocks,
    myBookings: mine,
    // the member directory is for club members only; GUEST accounts can be created by anyone
    members: showNames ? members.filter((m) => m.role !== "GUEST" && m.role !== "PLATFORM_ADMIN").map(toPerson) : [],
    partners: user && showNames ? frequentPartners(mine, user.id, members) : [],
    wallet: wallet?.balance ?? 0,
    /** Days ahead the user may book (membership plan), null = club default. */
    windowDays: member?.plan?.bookingWindowDays ?? null,
    favoriteUserIds: member?.favoriteUserIds ?? [],
    /** Price preview: anonymous visitors and GUEST accounts without Abo pay the guest rate. */
    guestRate: paysGuestRate(Boolean(user), member?.role, Boolean(member?.plan)),
    /** Sports the active Abo covers (price preview); null = no Abo. */
    planSports: member?.plan?.sports ?? null,
  };
}
