import { loadClubData } from "@/lib/club-data";
import { HomeView } from "@/components/app/home-view";
import { getMembershipPlansByTenantId } from "@/lib/data";

export default async function ClubHomePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const d = await loadClubData(clubSlug);
  const plans = d.user ? [] : (await getMembershipPlansByTenantId(d.tenant.id)).filter((p) => p.price > 0);
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
      wallet={d.wallet}
      guestRate={d.guestRate}
      minPlanPrice={plans.length ? Math.min(...plans.map((p) => p.price)) : null}
    />
  );
}
