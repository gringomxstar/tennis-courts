import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getCourtsByTenantId, getMemberContext } from "@/lib/data";
import { CoachBlockForm } from "@/components/app/coach-block-form";

export default async function TrainerPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant, user, isTenantAdmin } = await getTenantContext(clubSlug);
  const member = user ? await getMemberContext(tenant.id, user.id) : null;
  if (!isTenantAdmin && member?.role !== "COACH") notFound();
  const courts = (await getCourtsByTenantId(tenant.id)).filter((c) => c.status === "ACTIVE");
  return <CoachBlockForm slug={tenant.slug} courts={courts} />;
}
