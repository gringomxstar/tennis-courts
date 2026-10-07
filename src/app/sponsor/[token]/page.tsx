import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { coversYear, itemHint, freePlaces, yearlyAmount } from "@/lib/sponsoring";
import { currentSponsorYear, takenByItem } from "@/lib/sponsor-server";
import { SponsorPortal, type PortalItem } from "@/components/app/sponsor-portal";

export const metadata: Metadata = { title: "Sponsoring", robots: { index: false, follow: false } };

/** Personal sponsor portal (replaces the PDF form). The unguessable link is the only key; no login. */
export default async function SponsorPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await prisma.sponsor.findUnique({
    where: { token },
    include: {
      tenant: true,
      contracts: { where: { cancelledAt: null }, include: { lines: { include: { item: true } } }, orderBy: { startYear: "desc" } },
      invoices: { orderBy: { number: "desc" } },
    },
  });
  if (!s) notFound();
  const year = await currentSponsorYear(s.tenantId);
  const [items, taken, request] = await Promise.all([
    prisma.sponsorItem.findMany({ where: { tenantId: s.tenantId, active: true }, orderBy: [{ sortOrder: "asc" }, { price: "desc" }] }),
    takenByItem(s.tenantId, year),
    prisma.sponsorRequest.findUnique({ where: { sponsorId_year: { sponsorId: s.id, year } } }),
  ]);

  const cur = s.contracts.find((c) => coversYear(c, year));
  const prev = s.contracts.find((c) => coversYear(c, year - 1));
  const portalItems: PortalItem[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    description: it.description,
    price: Number(it.price),
    hasImage: Boolean(it.imageType),
    free: freePlaces(it.capacity, taken.get(it.id) ?? 0),
    exclusive: it.capacity === 1,
    hint: itemHint(it.capacity, taken.get(it.id) ?? 0, it.badge),
  }));
  const lines = (c: NonNullable<typeof cur>) => c.lines.map((l) => ({ itemId: l.itemId, name: l.item.name, quantity: l.quantity, price: Number(l.unitPrice) }));

  return (
    <SponsorPortal
      token={token}
      clubName={s.tenant.name}
      clubLogo={s.tenant.logoUrl}
      sponsorName={s.name}
      year={year}
      state={cur ? "confirmed" : request?.status === "DECLINED" ? "declined" : "open"}
      items={portalItems}
      prev={prev ? lines(prev) : []}
      current={cur ? {
        lines: lines(cur), years: cur.years, startYear: cur.startYear, discountPct: cur.discountPct,
        amount: yearlyAmount(cur.lines.map((l) => ({ quantity: l.quantity, unitPrice: Number(l.unitPrice) })), cur.discountPct),
      } : null}
      invoices={s.invoices.map((i) => ({ id: i.id, number: i.number, year: i.year, amount: Number(i.amount), paid: Boolean(i.paidAt) }))}
      logo={s.logoType ? { type: s.logoType, confirmed: Boolean(s.logoConfirmedAt), v: s.updatedAt.getTime() } : null}
    />
  );
}
