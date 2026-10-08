import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/stats";

const LABEL = { YES: "Zusage", NO: "Absage", INVITED: "Offen", WAITLIST: "Warteliste" } as const;

/** Einladungen eines Anlasses als CSV (nur Club-Admin; Bemerkungen sind nur für Admins). */
export async function GET(_req: Request, { params }: { params: Promise<{ clubSlug: string; id: string }> }) {
  const { clubSlug, id } = await params;
  const { tenant, isTenantAdmin } = await getTenantContext(clubSlug);
  if (!isTenantAdmin) return new Response("Keine Berechtigung", { status: 403 });
  const e = await prisma.event.findFirst({ where: { id, tenantId: tenant.id }, include: { invites: { orderBy: { name: "asc" } } } });
  if (!e) return new Response("Nicht gefunden", { status: 404 });
  const d = (x: Date | null) => (x ? x.toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" }) : "");
  const rows = [
    ["Name", "Typ", "E-Mail", "Antwort", "Begleitpersonen", "Bemerkung", "Antwort am"],
    ...e.invites.map((i) => [i.name, i.sponsorId ? "Sponsor" : "Mitglied", i.email ?? "", LABEL[i.reply], i.plusOnes, i.comment ?? "", d(i.respondedAt)]),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}-anlass-${e.startsAt.toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
