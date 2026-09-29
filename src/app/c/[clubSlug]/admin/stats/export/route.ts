import { getTenantContext } from "@/lib/tenant";
import { EXPORTS, exportRows, loadStats, toCsv, type ExportType } from "@/lib/stats";

export async function GET(req: Request, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant, isTenantAdmin } = await getTenantContext(clubSlug);
  if (!isTenantAdmin) return new Response("Keine Berechtigung", { status: 403 });
  if (!process.env.DATABASE_URL) return new Response("Keine Datenbank", { status: 503 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ExportType;
  if (!(type in EXPORTS)) return new Response("Unbekannter Export", { status: 400 });
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();

  const s = tenant.settingsJson;
  const stats = await loadStats(tenant.id, year, s?.openingHour ?? 7, s?.closingHour ?? 22);
  return new Response(toCsv(exportRows(stats, type)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}-${type}-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
