import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { EventEditor } from "@/components/app/event-form";

export default async function NewEventPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const courts = await prisma.court.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <EventEditor slug={tenant.slug} courts={courts} />;
}
