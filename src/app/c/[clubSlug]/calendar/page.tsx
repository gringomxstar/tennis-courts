import { after } from "next/server";
import { syncPendingBookingPayments } from "@/lib/booking-payment";
import { loadClubData } from "@/lib/club-data";
import { getTenantContext } from "@/lib/tenant";
import { CalendarView } from "@/components/app/calendar-view";

/** Trainer/admin browse this many days ahead (members: plan window, max 7). */
const WIDE = 62;

export default async function CalendarPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { isTenantAdmin } = await getTenantContext(clubSlug);
  const d = await loadClubData(clubSlug, isTenantAdmin ? WIDE : 8, { admin: isTenantAdmin, members: true, coachDays: WIDE });
  // Abgebrochene Zahlungen: nach Stripe-Ablauf (30 min) Slot freigeben, auch ohne Webhook.
  after(() => syncPendingBookingPayments(d.tenant.id));
  return (
    <CalendarView
      tenant={d.tenant}
      courts={d.courts}
      bookings={d.bookings}
      blocks={d.blocks}
      userId={d.user?.id}
      partners={d.partners}
      wallet={d.wallet}
      guestRate={!isTenantAdmin && d.guestRate}
      needPartner={d.needPartner}
      planSports={d.planSports}
      windowDays={isTenantAdmin ? null : d.windowDays}
      horizon={isTenantAdmin || d.isCoach ? WIDE - 1 : undefined}
      admin={isTenantAdmin}
    />
  );
}
