import { requireTenantAdmin } from "@/lib/tenant";
import { getTenantMembers } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { AdminMembers, type MemberRow } from "@/components/app/admin-members";

const RANK = { ACTIVE: 0, PENDING: 1, EXPIRED: 2, CANCELLED: 3 } as const;

export default async function AdminMembersPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const members = await getTenantMembers(tenant.id);

  // Memberships are Postgres/Stripe-only (see api/checkout/route.ts), no mockDb equivalent,
  // so this queries Prisma directly, same as the invoice lookup on the old admin page.
  const best = new Map<string, { status: keyof typeof RANK; planName: string; stripeCustomerId: string | null }>();
  if (process.env.DATABASE_URL) {
    const memberships = await prisma.membership.findMany({
      where: { tenantId: tenant.id },
      include: { user: true, plan: true },
      orderBy: { startsAt: "desc" },
    });
    for (const m of memberships) {
      const cur = best.get(m.userId);
      if (!cur || RANK[m.status] < RANK[cur.status]) {
        best.set(m.userId, { status: m.status, planName: m.plan.name, stripeCustomerId: m.user.stripeCustomerId });
      }
    }
  }

  const rows: MemberRow[] = members
    // guest checkouts create GUEST users; keep them only if they bought a membership
    .filter((m) => m.role !== "GUEST" || best.has(m.id))
    .map((m) => {
      const ms = best.get(m.id);
      return {
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        plan: ms?.planName ?? "Keine Mitgliedschaft",
        state: ms?.status === "ACTIVE" ? "paid" : ms?.status === "PENDING" && ms.stripeCustomerId ? "invoice" : "remind",
        stripeCustomerId: ms?.status === "PENDING" ? ms.stripeCustomerId : null,
        role: m.role,
      };
    });

  return (
    <>
      <div className="px-5 pt-[66px] lg:pt-12">
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Mitglieder</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">Zahlungen Saison {new Date().getFullYear()}</div>
      </div>
      <AdminMembers slug={tenant.slug} tenantId={tenant.id} members={rows} />
    </>
  );
}
