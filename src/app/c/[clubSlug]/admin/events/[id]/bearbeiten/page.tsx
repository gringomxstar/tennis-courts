import { notFound, redirect } from "next/navigation";
import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { EventEditor, type EventForm } from "@/components/app/event-form";

const zone = (d: Date) => d.toLocaleString("sv-SE", { timeZone: "Europe/Zurich" }); // "YYYY-MM-DD HH:mm:ss"

export default async function EditEventPage({ params }: { params: Promise<{ clubSlug: string; id: string }> }) {
  const { clubSlug, id } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const e = await prisma.event.findFirst({ where: { id, tenantId: tenant.id }, include: { courtBlocks: { select: { courtId: true } } } });
  if (!e) notFound();
  if (e.cancelledAt) redirect(`/c/${tenant.slug}/admin/events/${id}`);
  const courts = await prisma.court.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const [day, time] = zone(e.startsAt).split(" ");
  const form: EventForm = {
    id: e.id, kind: e.kind, title: e.title, date: day, time: time.slice(0, 5), endTime: zone(e.endsAt).split(" ")[1].slice(0, 5),
    location: e.location ?? "", description: e.description ?? "", priceNote: e.priceNote ?? "", deadline: e.deadline ? zone(e.deadline).slice(0, 10) : "",
    maxSeats: e.maxSeats ? String(e.maxSeats) : "", maxPlusOnes: String(e.maxPlusOnes), courtIds: e.courtBlocks.map((b) => b.courtId), mailMembers: e.mailMembers,
  };
  return <EventEditor slug={tenant.slug} courts={courts} initial={form} />;
}
