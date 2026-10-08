import { loadClubData } from "@/lib/club-data";
import { HomeView } from "@/components/app/home-view";
import { getMembershipPlansByTenantId } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { seatsTaken, waitlistPosition } from "@/lib/events";
import type { MemberEvent } from "@/components/app/event-reply";

const DAY = 86_400_000;

export default async function ClubHomePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const d = await loadClubData(clubSlug, 8, { members: true });
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
  const TZ = "Europe/Zurich";
  const invites = d.user && process.env.DATABASE_URL
    ? await prisma.eventInvite
        .findMany({
          where: { userId: d.user.id, event: { tenantId: d.tenant.id, cancelledAt: null, startsAt: { gt: now } } },
          include: { event: { include: { invites: true } } },
          orderBy: { event: { startsAt: "asc" } },
          take: 3,
        })
        .catch(() => [])
    : [];
  const events: MemberEvent[] = invites.map((i) => ({
    inviteId: i.id,
    title: i.event.title,
    whenText: i.event.startsAt.toLocaleString("de-CH", { timeZone: TZ, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }),
    location: i.event.location,
    reply: i.reply,
    plusOnes: i.plusOnes,
    waitPos: waitlistPosition(i.event.invites, i.id),
    maxPlusOnes: i.event.maxPlusOnes,
    deadlinePassed: Boolean(i.event.deadline && now > i.event.deadline),
    yesCount: seatsTaken(i.event.invites),
    names: i.event.invites.filter((x) => x.reply === "YES" && !x.sponsorId).map((x) => x.name + (x.plusOnes ? ` (+${x.plusOnes})` : "")),
  }));
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
      planSports={d.planSports}
      minPlanPrice={plans.length ? Math.min(...plans.map((p) => p.price)) : null}
      aboCta={plans.length ? aboCta : null}
      events={events}
    />
  );
}
