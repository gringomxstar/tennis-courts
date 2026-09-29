import { loadClubData } from "@/lib/club-data";
import { HomeView } from "@/components/app/home-view";
import { getMembershipPlansByTenantId } from "@/lib/data";
import { prisma } from "@/lib/prisma";

const DAY = 86_400_000;

export default async function ClubHomePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const d = await loadClubData(clubSlug);
  const now = new Date();
  const admin = d.user?.role === "CLUB_ADMIN" || d.user?.role === "PLATFORM_ADMIN";
  const [plans, lastEnd] = await Promise.all([
    getMembershipPlansByTenantId(d.tenant.id).then((ps) => ps.filter((p) => p.price > 0)),
    // latest end of a running Abo (a renewal for next season counts)
    d.user && d.planSports && process.env.DATABASE_URL
      ? prisma.membership
          .findFirst({
            where: { userId: d.user.id, tenantId: d.tenant.id, status: "ACTIVE", endsAt: { gt: now } },
            orderBy: { endsAt: "desc" },
            select: { endsAt: true },
          })
          .then((m) => m?.endsAt ?? null)
          .catch(() => null)
      : null,
  ]);
  const aboCta = !d.user
    ? null
    : !d.planSports
      ? admin ? null : "join"
      : lastEnd && lastEnd.getTime() - now.getTime() < 30 * DAY
        ? "renew"
        : null;
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
      needPartner={d.needPartner}
      canAdmin={d.ctx.isTenantAdmin}
      planSports={d.planSports}
      minPlanPrice={plans.length ? Math.min(...plans.map((p) => p.price)) : null}
      aboCta={plans.length ? aboCta : null}
    />
  );
}
