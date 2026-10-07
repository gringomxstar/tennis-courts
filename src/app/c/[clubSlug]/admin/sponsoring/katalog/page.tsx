import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { holdsPlace } from "@/lib/sponsoring";
import { currentSponsorYear } from "@/lib/sponsor-server";
import { SponsorNav } from "@/components/app/admin-sponsoring";
import { SponsorCatalog } from "@/components/app/sponsor-catalog";

export default async function SponsorCatalogPage({ params, searchParams }: { params: Promise<{ clubSlug: string }>; searchParams: Promise<{ jahr?: string }> }) {
  const [{ clubSlug }, { jahr }] = await Promise.all([params, searchParams]);
  const { tenant } = await requireTenantAdmin(clubSlug);
  const year = Number(jahr) || (await currentSponsorYear(tenant.id));
  const now = new Date();
  const items = await prisma.sponsorItem.findMany({
    where: { tenantId: tenant.id },
    include: { lines: { where: { contract: { cancelledAt: null } }, include: { contract: { include: { sponsor: { select: { id: true, name: true } } } } } } },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { price: "desc" }],
  });
  return (
    <>
      <div className="px-5 pt-3 @min-[640px]:pt-0">
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Katalog</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">Angebote für Sponsoren, Preise und was {year} schon vergeben ist</div>
      </div>
      <SponsorNav slug={tenant.slug} active="katalog" year={year} />
      <SponsorCatalog
        slug={tenant.slug}
        year={year}
        items={items.map((it) => {
          const cur = it.lines.filter((l) => holdsPlace(l.contract, l, year, now));
          return {
            id: it.id, name: it.name, description: it.description ?? "", price: Number(it.price), capacity: it.capacity, badge: it.badge ?? "",
            deliverables: it.deliverables, hasImage: Boolean(it.imageType), sortOrder: it.sortOrder, active: it.active,
            taken: cur.reduce((a, l) => a + l.quantity, 0),
            sponsors: cur.map((l) => ({ id: l.contract.sponsor.id, name: l.contract.sponsor.name, quantity: l.quantity })),
          };
        })}
      />
    </>
  );
}
