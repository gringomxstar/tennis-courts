import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { contractAmount, freePlaces, hasYear } from "@/lib/sponsoring";
import { currentSponsorYear, portalUrl, takenByItem } from "@/lib/sponsor-server";
import { SponsorCard } from "@/components/app/sponsor-card";

export default async function SponsorCardPage({ params }: { params: Promise<{ clubSlug: string; id: string }> }) {
  const { clubSlug, id } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const s = await prisma.sponsor.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      contacts: true,
      contracts: { include: { lines: { include: { item: true } } }, orderBy: { startYear: "desc" } },
      requests: { orderBy: { year: "desc" } },
      invoices: { orderBy: { number: "desc" } },
      deliverables: { orderBy: [{ year: "desc" }, { label: "asc" }] },
      tasks: { where: { doneAt: null }, include: { assignee: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!s) notFound();
  const year = await currentSponsorYear(tenant.id);
  const [board, items, taken, logs] = await Promise.all([
    prisma.tenantUser.findMany({ where: { tenantId: tenant.id, role: { in: ["CLUB_ADMIN", "COURT_MANAGER", "COACH"] } }, include: { user: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.sponsorItem.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: [{ sortOrder: "asc" }, { price: "desc" }] }),
    takenByItem(tenant.id, year),
    prisma.auditLog.findMany({ where: { tenantId: tenant.id, entityType: "Sponsor", entityId: s.id }, include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const status = (y: number) => s.contracts.some((c) => !c.cancelledAt && hasYear(c, y)) ? "CONFIRMED" : s.requests.find((r) => r.year === y)?.status ?? "NONE";

  return (
    <>
      <div className="px-5 pt-3 @min-[640px]:pt-0">
        <Link href={`/c/${tenant.slug}/admin/sponsoring`} className="inline-flex items-center gap-1 text-[15px] font-semibold text-clay-text"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Sponsoring</Link>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-.035em]">{s.name}</h1>
      </div>
      <SponsorCard
        slug={tenant.slug}
        year={year}
        status={status(year) as "NONE"}
        sponsor={{
          id: s.id, name: s.name, street: s.street ?? "", zip: s.zip ?? "", city: s.city ?? "", website: s.website ?? "", notes: s.notes ?? "",
          ownerId: s.ownerId ?? "", portal: portalUrl(s.token), token: s.token,
          logo: s.logoType ? { type: s.logoType, confirmed: s.logoConfirmedAt?.toISOString() ?? "" } : null,
          contacts: s.contacts.map((c) => ({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", role: c.role ?? "", isPrimary: c.isPrimary })),
        }}
        board={board.map((b) => ({ id: b.user.id, name: `${b.user.firstName} ${b.user.lastName}`.trim() }))}
        items={items.map((it) => ({ id: it.id, name: it.name, price: Number(it.price), free: freePlaces(it.capacity, taken.get(it.id) ?? 0) }))}
        contracts={s.contracts.map((c) => ({
          id: c.id, startYear: c.startYear, years: c.years, discountPct: c.discountPct, source: c.source, cancelled: Boolean(c.cancelledAt),
          amount: contractAmount(c, Math.max(c.startYear, Math.min(year, c.startYear + c.years - 1))),
          lines: c.lines.map((l) => ({ name: l.item.name, quantity: l.quantity, price: Number(l.unitPrice), fromYear: l.fromYear, pending: Boolean(l.pendingUntil) })),
          billedYears: s.invoices.filter((i) => i.contractId === c.id).map((i) => i.year),
        }))}
        years={[...new Set([year, ...s.requests.map((r) => r.year), ...s.contracts.flatMap((c) => Array.from({ length: c.years }, (_, i) => c.startYear + i))])].sort((a, b) => b - a).map((y) => ({ year: y, status: status(y) }))}
        invoices={s.invoices.map((i) => ({ id: i.id, number: i.number, year: i.year, amount: Number(i.amount), dueAt: i.dueAt.toISOString(), paidAt: i.paidAt?.toISOString() ?? "", dunningLevel: i.dunningLevel, sent: Boolean(i.sentAt), overdue: !i.paidAt && i.dueAt < new Date() }))}
        deliverables={s.deliverables.map((d) => ({ id: d.id, year: d.year, label: d.label, done: Boolean(d.doneAt) }))}
        tasks={s.tasks.map((t) => ({ id: t.id, title: t.title, assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "" }))}
        history={logs.map((l) => ({ at: l.createdAt.toISOString(), text: (l.metadataJson as { text?: string } | null)?.text ?? l.action, by: l.actor ? `${l.actor.firstName} ${l.actor.lastName}`.trim() : "System" }))}
      />
    </>
  );
}
