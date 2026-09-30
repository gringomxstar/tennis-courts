import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getCourtsByTenantId, getMemberContext } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { CoachBlockForm, type CourseSummary } from "@/components/app/coach-block-form";

export default async function TrainerPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant, user, isTenantAdmin } = await getTenantContext(clubSlug);
  const member = user ? await getMemberContext(tenant.id, user.id) : null;
  if (!user || (!isTenantAdmin && member?.role !== "COACH")) notFound();
  const courts = (await getCourtsByTenantId(tenant.id)).filter((c) => c.status === "ACTIVE");

  const rows = await prisma.booking.findMany({
    where: {
      tenantId: tenant.id,
      idempotencyKey: { startsWith: "kurs:" },
      status: { not: "CANCELLED" },
      startsAt: { gt: new Date() },
      ...(isTenantAdmin ? {} : { organizerId: user.id }),
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, idempotencyKey: true, notes: true, courtId: true, startsAt: true, endsAt: true },
  });
  const byKurs = new Map<string, CourseSummary>();
  for (const r of rows) {
    const kursId = r.idempotencyKey!.split(":")[1];
    const c = byKurs.get(kursId) ?? { kursId, bookingId: r.id, name: r.notes ?? "Kurs", count: 0, next: r.startsAt.toISOString(), courts: [] };
    const minutes = (r.endsAt.getTime() - r.startsAt.getTime()) / 60_000;
    const line = c.courts.find((x) => x.courtId === r.courtId);
    if (line) line.count++;
    else c.courts.push({ courtId: r.courtId, minutes, count: 1 });
    c.count++;
    byKurs.set(kursId, c);
  }
  return <CoachBlockForm slug={tenant.slug} courts={courts} courses={[...byKurs.values()]} />;
}
