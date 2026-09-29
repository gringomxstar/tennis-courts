import { requireTenantAdmin } from "@/lib/tenant";
import { loadClubData } from "@/lib/club-data";
import { CalendarView } from "@/components/app/calendar-view";

export default async function AdminCalendarPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  await requireTenantAdmin(clubSlug);
  const d = await loadClubData(clubSlug, 8, { admin: true, members: true });
  return (
    <CalendarView
      tenant={d.tenant}
      courts={d.courts}
      bookings={d.bookings}
      blocks={d.blocks}
      userId={d.user?.id}
      partners={d.partners}
      wallet={d.wallet}
      guestRate={false}
      planSports={d.planSports}
      windowDays={null}
      admin
    />
  );
}
