import { loadClubData } from "@/lib/club-data";
import { HomeView } from "@/components/app/home-view";

export default async function ClubHomePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const d = await loadClubData(clubSlug);
  return (
    <HomeView
      tenant={d.tenant}
      courts={d.courts}
      bookings={d.bookings}
      blocks={d.blocks}
      myBookings={d.myBookings}
      userId={d.user?.id}
      firstName={d.user?.name?.split(" ")[0] ?? ""}
      partners={d.partners}
    />
  );
}
