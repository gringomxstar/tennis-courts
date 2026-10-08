import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/stats";
import { STAGES, contractAmount, contractEnd } from "@/lib/sponsoring";

/** All sponsors as CSV (Excel opens it directly). */
export async function GET(_req: Request, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant, isTenantAdmin } = await getTenantContext(clubSlug);
  if (!isTenantAdmin) return new Response("Keine Berechtigung", { status: 403 });
  const year = new Date().getFullYear();
  const sponsors = await prisma.sponsor.findMany({
    where: { tenantId: tenant.id },
    include: {
      owner: true, contacts: true, noteList: { where: { followUpAt: { not: null }, followUpDoneAt: null }, orderBy: { followUpAt: "asc" }, take: 1 },
      contracts: { where: { cancelledAt: null }, include: { lines: true } },
    },
    orderBy: { name: "asc" },
  });
  const d = (x: Date | null) => (x ? x.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }) : "");
  const rows = [
    ["Firma", "Stufe", "Verantwortlicher", "Hauptkontakt", "E-Mail", "Telefon", "Ort", `Betrag ${year} CHF`, "Vertragsende", "Nächste Wiedervorlage"],
    ...sponsors.map((s) => {
      const c = s.contacts.find((x) => x.isPrimary && x.email) ?? s.contacts.find((x) => x.email) ?? s.contacts[0];
      const ends = s.contracts.map((x) => contractEnd(x)!).sort((a, b) => b.getTime() - a.getTime());
      const amount = s.contracts.reduce((sum, x) => sum + contractAmount(x, year), 0);
      return [
        s.name, STAGES.find((x) => x.value === s.stage)?.label ?? "", s.owner ? `${s.owner.firstName} ${s.owner.lastName}` : "",
        c?.name ?? "", c?.email ?? "", c?.phone ?? "", s.city ?? "", amount ? amount.toFixed(2) : "",
        ends[0] ? d(new Date(ends[0].getTime() + 12 * 3600_000)) : "", d(s.noteList[0]?.followUpAt ?? null),
      ];
    }),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}-sponsoren.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
