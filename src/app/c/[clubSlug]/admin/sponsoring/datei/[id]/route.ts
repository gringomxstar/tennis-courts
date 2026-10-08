import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/** Sponsor PDF (offer, contract) for club admins only. Sandbox CSP so a script inside the PDF can't run on our origin. */
export async function GET(_req: Request, { params }: { params: Promise<{ clubSlug: string; id: string }> }) {
  const { clubSlug, id } = await params;
  const { tenant, isTenantAdmin } = await getTenantContext(clubSlug);
  if (!isTenantAdmin) return new Response("Keine Berechtigung", { status: 403 });
  const f = await prisma.sponsorFile.findFirst({ where: { id, sponsor: { tenantId: tenant.id } } });
  if (!f) return new Response("Nicht gefunden", { status: 404 });
  return new Response(Buffer.from(f.data), {
    headers: {
      "Content-Type": f.type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(f.name)}"`,
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
