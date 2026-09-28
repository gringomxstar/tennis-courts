import { requireTenantAdmin } from "@/lib/tenant";
import { getBlocksInRange, getCourtsByTenantId } from "@/lib/data";
import { AdminBlocks } from "@/components/app/admin-blocks";

/** now-1d .. now+2d as ISO, wide enough for any client timezone's "today". */
function range() {
  const now = Date.now();
  return [new Date(now - 86_400_000).toISOString(), new Date(now + 2 * 86_400_000).toISOString()];
}

export default async function AdminBlocksPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);

  const [from, to] = range();
  const [courts, blocks] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getBlocksInRange(tenant.id, from, to),
  ]);

  return (
    <AdminBlocks
      slug={tenant.slug}
      settings={tenant.settingsJson}
      courts={courts.filter((c) => c.status === "ACTIVE")}
      blocks={blocks}
    />
  );
}
