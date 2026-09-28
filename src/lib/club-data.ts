import { getTenantContext } from "@/lib/tenant";
import {
  getBlocksInRange,
  getBookingsInRange,
  getCourtsByTenantId,
  getTenantMembers,
  getUserBookings,
} from "@/lib/data";
import { syncPendingBookingPayments } from "@/lib/booking-payment";
import { frequentPartners, toPerson } from "@/lib/partners";

/** Everything the player screens need; the client derives local-time slots from the ISO data. */
export async function loadClubData(slug: string, days = 8) {
  const ctx = await getTenantContext(slug);
  const { tenant, user } = ctx;
  await syncPendingBookingPayments(tenant.id);

  // one day of slack either side covers any client timezone offset
  const from = new Date(Date.now() - 86_400_000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + (days + 2) * 86_400_000);

  const [courts, bookings, blocks, members, mine] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getBookingsInRange(tenant.id, from.toISOString(), to.toISOString()),
    getBlocksInRange(tenant.id, from.toISOString(), to.toISOString()),
    getTenantMembers(tenant.id),
    user ? getUserBookings(user.id, tenant.id) : Promise.resolve([]),
  ]);

  return {
    ctx,
    tenant,
    user,
    courts: courts.filter((c) => c.status === "ACTIVE"),
    bookings,
    blocks,
    myBookings: mine,
    members: members.filter((m) => m.role !== "GUEST" && m.role !== "PLATFORM_ADMIN").map(toPerson),
    partners: user ? frequentPartners(mine, user.id, members) : [],
  };
}
