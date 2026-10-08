import { notFound } from "next/navigation";
import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { mainContact } from "@/lib/sponsor-server";
import { seatsTaken, waitlistPosition } from "@/lib/events";
import { AdminEventDetail, type InviteRow, type Person } from "@/components/app/admin-event-detail";

export default async function AdminEventPage({ params }: { params: Promise<{ clubSlug: string; id: string }> }) {
  const { clubSlug, id } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const e = await prisma.event.findFirst({
    where: { id, tenantId: tenant.id },
    include: { invites: { orderBy: { name: "asc" } } },
  });
  if (!e) notFound();
  const [plans, members, sponsors] = await Promise.all([
    prisma.membershipPlan.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.tenantUser.findMany({ where: { tenantId: tenant.id, status: "ACTIVE", role: { not: "GUEST" } }, include: { user: true } }),
    prisma.sponsor.findMany({ where: { tenantId: tenant.id }, include: { contacts: true } }),
  ]);
  const mailable = (email: string | null, sponsor: boolean) => Boolean(email) && (sponsor || e.mailMembers);
  const invUsers = new Set(e.invites.map((i) => i.userId)), invSponsors = new Set(e.invites.map((i) => i.sponsorId));
  const rows: InviteRow[] = e.invites.map((i) => ({
    id: i.id, name: i.name, sponsor: Boolean(i.sponsorId), plusOnes: i.plusOnes, comment: i.comment ?? "", reply: i.reply,
    respondedAt: i.respondedAt?.toISOString() ?? null, mailable: mailable(i.email, Boolean(i.sponsorId)), hasEmail: Boolean(i.email), sentAt: i.sentAt?.toISOString() ?? null, waitPos: waitlistPosition(e.invites, i.id),
  }));
  const people: Person[] = [
    ...members.filter((t) => !invUsers.has(t.userId)).map((t) => ({ key: `u:${t.userId}`, name: `${t.user.firstName} ${t.user.lastName}`.trim(), sponsor: false, mailable: mailable(t.user.email, false) })),
    ...sponsors.filter((s) => !invSponsors.has(s.id)).map((s) => ({ key: `s:${s.id}`, name: mainContact(s)?.name || s.name, sponsor: true, mailable: mailable(mainContact(s)?.email ?? null, true) })),
  ].sort((a, b) => a.name.localeCompare(b.name, "de"));
  return (
    <AdminEventDetail
      slug={tenant.slug} plans={plans} rows={rows} people={people}
      event={{ id: e.id, title: e.title, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), location: e.location ?? "", deadline: e.deadline?.toISOString() ?? null, maxSeats: e.maxSeats, mailMembers: e.mailMembers, cancelled: Boolean(e.cancelledAt), seats: seatsTaken(e.invites) }}
    />
  );
}
