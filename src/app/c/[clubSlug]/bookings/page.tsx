import { getTenantContext } from "@/lib/tenant";
import { syncPendingBookingPayments } from "@/lib/booking-payment";
import { getCourtsByTenantId, getUserBookings } from "@/lib/data";
import { BookingsView } from "@/components/app/bookings-view";

export default async function BookingsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant, user } = await getTenantContext(clubSlug);
  if (user) await syncPendingBookingPayments(tenant.id);

  const [bookings, courts] = await Promise.all([
    user ? getUserBookings(user.id, tenant.id) : Promise.resolve([]),
    getCourtsByTenantId(tenant.id),
  ]);

  return <BookingsView slug={tenant.slug} userId={user?.id} bookings={bookings} courts={courts} cancelDeadlineHours={tenant.settingsJson?.cancellationDeadlineHours ?? 24} />;
}
