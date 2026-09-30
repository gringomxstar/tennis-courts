import { after } from "next/server";
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
import { frequentPartners, isPartner, toPerson } from "@/lib/partners";
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
export async function loadClubData(slug: string, days = 8, opts: { admin?: boolean; members?: boolean; coachDays?: number } = {}) {
  const ctx = await getTenantContext(slug);
  const { tenant, user } = ctx;
  after(() => syncPendingBookingPayments(tenant.id));

  // one day of slack either side covers any client timezone offset
  const from = new Date(Date.now() - 86_400_000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + (days + 2) * 86_400_000);

  const [courts, bookings, blocks, members, mine, wallet, member] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getBookingsInRange(tenant.id, from.toISOString(), to.toISOString()),
    getBlocksInRange(tenant.id, from.toISOString(), to.toISOString()),
    opts.members ? getTenantMembers(tenant.id) : Promise.resolve([]),
    user ? getUserBookings(user.id, tenant.id) : Promise.resolve([]),
    user ? getUserWallet(tenant.id, user.id) : null,
    user ? getMemberContext(tenant.id, user.id) : null,
  ]);

  // trainers browse further ahead than members: fetch the extra range only for them
  if (member?.role === "COACH" && opts.coachDays && opts.coachDays > days) {
    const far = new Date(from.getTime() + (opts.coachDays + 2) * 86_400_000).toISOString();
    const [moreBookings, moreBlocks] = await Promise.all([getBookingsInRange(tenant.id, to.toISOString(), far), getBlocksInRange(tenant.id, to.toISOString(), far)]);
    bookings.push(...moreBookings);
    blocks.push(...moreBlocks);
  }

  // DB role, not the JWT: a claimed guest account stays GUEST and sees no names
  // callers pass admin only after requireTenantAdmin
  const showNames = Boolean(opts.admin || (member?.role && member.role !== "GUEST"));
  return {
    ctx,
    tenant,
    user,
    courts: courts.filter((c) => c.status === "ACTIVE"),
    bookings: bookings.map((b) => publicBooking(b, showNames)),
    blocks,
    myBookings: mine,
    // the member directory is for club members only; GUEST accounts can be created by anyone
    members: showNames ? members.filter(isPartner).map(toPerson) : [],
    partners: user && showNames ? frequentPartners(mine, user.id, members) : [],
    wallet: wallet?.balance ?? 0,
    /** Days ahead the user may book (membership plan), null = club default. */
    windowDays: member?.plan?.bookingWindowDays ?? null,
    favoriteUserIds: member?.favoriteUserIds ?? [],
    /** No running Abo: the booker's own share is paid (everybody needs an Abo, no role exceptions). */
    guestRate: !member?.plan,
    /** Sports the active Abo covers (price preview); null = no Abo. */
    planSports: member?.plan?.sports ?? null,
    /** Members must name at least one co-player or guest; admins, coaches and anonymous guests don't. */
    needPartner: Boolean(user) && !ctx.isTenantAdmin && member?.role !== "COACH",
    /** Trainer: 2h alone and weekly series. */
    isCoach: member?.role === "COACH",
  };
}
