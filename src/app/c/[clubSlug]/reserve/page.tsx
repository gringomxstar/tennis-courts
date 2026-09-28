import { redirect } from "next/navigation";
import { loadClubData } from "@/lib/club-data";
import { ReserveView } from "@/components/app/reserve-view";

export default async function ReservePage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ court?: string; start?: string; players?: string }>;
}) {
  const { clubSlug } = await params;
  const sp = await searchParams;
  const d = await loadClubData(clubSlug);
  const court = d.courts.find((c) => c.id === sp.court);
  const start = sp.start && !Number.isNaN(Date.parse(sp.start)) ? sp.start : null;
  if (!d.user) redirect(`/c/${clubSlug}/profile`);
  if (!court || !start) redirect(`/c/${clubSlug}/calendar`);
  return (
    <ReserveView
      tenant={d.tenant}
      court={court}
      start={start}
      initialPlayers={(sp.players ?? "").split(",").filter(Boolean)}
      members={d.members}
      partners={d.partners}
      bookings={d.bookings}
      blocks={d.blocks}
      userId={d.user.id}
      wallet={d.wallet}
      favoriteUserIds={d.favoriteUserIds}
    />
  );
}
