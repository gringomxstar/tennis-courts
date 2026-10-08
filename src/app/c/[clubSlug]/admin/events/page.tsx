import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { seatsTaken } from "@/lib/events";
import { AdminEvents, type EventRow } from "@/components/app/admin-events";

export default async function AdminEventsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const events = process.env.DATABASE_URL
    ? await prisma.event.findMany({ where: { tenantId: tenant.id }, include: { invites: { select: { reply: true, plusOnes: true } } }, orderBy: { startsAt: "asc" } })
    : [];
  const now = new Date();
  const rows = events.map((e): EventRow & { over: boolean } => ({
    id: e.id, title: e.title, startsAt: e.startsAt.toISOString(), location: e.location ?? "", mailMembers: e.mailMembers, cancelled: Boolean(e.cancelledAt),
    yes: seatsTaken(e.invites), open: e.invites.filter((i) => i.reply === "INVITED").length, wait: e.invites.filter((i) => i.reply === "WAITLIST").length,
    maxSeats: e.maxSeats, draft: e.invites.length === 0, over: e.endsAt < now,
  }));
  return <AdminEvents slug={tenant.slug} upcoming={rows.filter((r) => !r.over)} past={rows.filter((r) => r.over).reverse()} />;
}
