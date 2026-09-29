import { loadClubData } from "@/lib/club-data";
import { getTenantContext } from "@/lib/tenant";
import { CalendarView } from "@/components/app/calendar-view";

export default async function CalendarPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { isTenantAdmin } = await getTenantContext(clubSlug);
  const d = await loadClubData(clubSlug, 8, { admin: isTenantAdmin, members: true });
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
      admin={isTenantAdmin}
    />
  );
}
