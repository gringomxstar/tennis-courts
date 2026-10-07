import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/stats";

/** Sponsor invoices of a year as CSV for the bookkeeping (Excel opens it directly). */
export async function GET(req: Request, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant, isTenantAdmin } = await getTenantContext(clubSlug);
  if (!isTenantAdmin) return new Response("Keine Berechtigung", { status: 403 });
  const year = Number(new URL(req.url).searchParams.get("jahr")) || new Date().getFullYear();
  const invoices = await prisma.sponsorInvoice.findMany({
    where: { tenantId: tenant.id, year },
    include: { sponsor: true, contract: { include: { lines: { include: { item: true } } } } },
    orderBy: { number: "asc" },
  });
  const d = (x: Date | null) => (x ? x.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }) : "");
  const rows = [
    ["Rechnung", "Datum", "Fällig", "Sponsor", "Adresse", "Leistungen", "Jahr", "Rabatt %", "Betrag CHF", "Bezahlt am", "Status", "Mahnstufe"],
    ...invoices.map((i) => [
      String(i.number), d(i.issuedAt), d(i.dueAt), i.sponsor.name,
      [i.sponsor.street, [i.sponsor.zip, i.sponsor.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      i.contract.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.item.name}`).join(", "),
      String(i.year), String(i.contract.discountPct), Number(i.amount).toFixed(2), d(i.paidAt),
      i.paidAt ? "bezahlt" : i.dueAt < new Date() ? "überfällig" : "offen", String(Math.min(i.dunningLevel, 2)),
    ]),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}-sponsoring-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
