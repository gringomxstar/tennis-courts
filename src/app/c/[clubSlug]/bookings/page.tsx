import { after } from "next/server";
import { cancelDeadlineMinutes } from "@/lib/booking-rules";
import { getTenantContext } from "@/lib/tenant";
import { syncPendingBookingPayments } from "@/lib/booking-payment";
import { getCourtsByTenantId, getMemberContext, getUserBookings } from "@/lib/data";
import { BookingsView } from "@/components/app/bookings-view";

export default async function BookingsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant, user } = await getTenantContext(clubSlug);
  if (user) after(() => syncPendingBookingPayments(tenant.id));

  const isCoach = user ? (await getMemberContext(tenant.id, user.id))?.role === "COACH" : false;
  const [bookings, courts] = await Promise.all([
    user ? getUserBookings(user.id, tenant.id) : Promise.resolve([]),
    getCourtsByTenantId(tenant.id),
  ]);

  return <BookingsView isCoach={isCoach} slug={tenant.slug} userId={user?.id} bookings={bookings} courts={courts} cancelDeadlineMinutes={cancelDeadlineMinutes(tenant.settingsJson)} />;
}
