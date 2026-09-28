import { requireTenantAdmin } from "@/lib/tenant";
import { getBlocksInRange, getBookingsInRange, getCourtsByTenantId } from "@/lib/data";
import { syncPendingBookingPayments } from "@/lib/booking-payment";
import { AdminToday } from "@/components/app/admin-today";

/** now-1d .. now+2d as ISO, wide enough for any client timezone's "today". */
function range() {
  const now = Date.now();
  return [new Date(now - 86_400_000).toISOString(), new Date(now + 2 * 86_400_000).toISOString()];
}

export default async function AdminTodayPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  await syncPendingBookingPayments(tenant.id);

  // server passes a wide ISO range; the client picks "today" in its local time
  const [from, to] = range();
  const [courts, bookings, blocks] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getBookingsInRange(tenant.id, from, to),
    getBlocksInRange(tenant.id, from, to),
  ]);

  return (
    <AdminToday
      slug={tenant.slug}
      settings={tenant.settingsJson}
      courts={courts.filter((c) => c.status === "ACTIVE")}
      bookings={bookings}
      blocks={blocks}
    />
  );
}
