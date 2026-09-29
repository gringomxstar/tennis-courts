import { loadClubData } from "@/lib/club-data";
import { CalendarView } from "@/components/app/calendar-view";

export default async function CalendarPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const d = await loadClubData(clubSlug);
  return (
    <CalendarView
      tenant={d.tenant}
      courts={d.courts}
      bookings={d.bookings}
      blocks={d.blocks}
      userId={d.user?.id}
      partners={d.partners}
      wallet={d.wallet}
      windowDays={d.windowDays}
    />
  );
}
