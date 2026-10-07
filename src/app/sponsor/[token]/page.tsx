import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { confirmedLines, contractAmount, hasYear, itemHint, freePlaces, lineInYear } from "@/lib/sponsoring";
import { currentSponsorYear, purgeExpiredCheckouts, takenByItem } from "@/lib/sponsor-server";
import { SponsorPortal, type PortalItem } from "@/components/app/sponsor-portal";

export const metadata: Metadata = { title: "Sponsoring", robots: { index: false, follow: false } };

/** Personal sponsor portal (replaces the PDF form). The unguessable link is the only key; no login. */
export default async function SponsorPortalPage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ bezahlt?: string; abbruch?: string }>;
}) {
  const [{ token }, q] = await Promise.all([params, searchParams]);
  await purgeExpiredCheckouts();
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

  const cur = s.contracts.find((c) => hasYear(c, year));
  const prev = s.contracts.find((c) => hasYear(c, year - 1));
  const pendingCheckout = s.contracts.some((c) => c.lines.some((l) => l.pendingUntil && lineInYear(c, l, year)));
  // an own open checkout doesn't block the sponsor's choice (a new purchase ends it)
  for (const c of s.contracts) for (const l of c.lines) {
    if (l.pendingUntil && lineInYear(c, l, year)) taken.set(l.itemId, (taken.get(l.itemId) ?? 0) - l.quantity);
  }
  const portalItems: PortalItem[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    description: it.description?.replace(" [Testdaten]", "") ?? null,
    price: Number(it.price),
    hasImage: Boolean(it.imageType),
    free: freePlaces(it.capacity, taken.get(it.id) ?? 0),
    exclusive: it.capacity === 1,
    hint: itemHint(it.capacity, taken.get(it.id) ?? 0, it.badge),
  }));
  const lines = (c: NonNullable<typeof cur>, y: number) => confirmedLines(c, y).map((l) => ({ itemId: l.itemId, name: l.item.name, quantity: l.quantity, price: Number(l.unitPrice) }));
  // back from Stripe: the webhook may still be on its way
  const paidNow = q.bezahlt ? (pendingCheckout ? "processing" : "paid") : null;

  return (
    <SponsorPortal
      key={cur ? `c${cur.lines.length}` : "open"}
      token={token}
      clubName={s.tenant.name}
      clubLogo={s.tenant.logoUrl}
      sponsorName={s.name}
      year={year}
      state={cur ? "confirmed" : request?.status === "DECLINED" ? "declined" : "open"}
      items={portalItems}
      prev={prev ? lines(prev, year - 1) : []}
      current={cur ? { lines: lines(cur, year), years: cur.years, startYear: cur.startYear, discountPct: cur.discountPct, amount: contractAmount(cur, year) } : null}
      invoices={s.invoices.map((i) => ({ id: i.id, number: i.number, year: i.year, amount: Number(i.amount), paid: Boolean(i.paidAt), online: i.paidVia === "stripe" }))}
      logo={s.logoType ? { type: s.logoType, confirmed: Boolean(s.logoConfirmedAt), v: s.updatedAt.getTime() } : null}
      canPayOnline={Boolean(process.env.STRIPE_SECRET_KEY)}
      checkout={paidNow}
      cancelSession={q.abbruch ?? null}
      pendingCheckout={pendingCheckout}
    />
  );
}
