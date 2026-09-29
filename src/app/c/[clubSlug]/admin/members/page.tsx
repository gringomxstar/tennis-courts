import { requireTenantAdmin } from "@/lib/tenant";
import { getMembershipPlansByTenantId, getTenantMembers } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { AdminMembers, ImportMembers, type MemberRow } from "@/components/app/admin-members";

const RANK = { ACTIVE: 0, PENDING: 1, EXPIRED: 2, CANCELLED: 3 } as const;

export default async function AdminMembersPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const [members, plans] = await Promise.all([getTenantMembers(tenant.id), getMembershipPlansByTenantId(tenant.id)]);

  // Memberships are Postgres/Stripe-only (see api/checkout/route.ts), no mockDb equivalent,
  // so this queries Prisma directly, same as the invoice lookup on the old admin page.
  const best = new Map<string, {
    status: keyof typeof RANK; planName: string; planId: string; stripeCustomerId: string | null;
    startsAt: Date; endsAt: Date | null; paidAt: Date | null; pricePaid: number | null;
  }>();
  const profile = new Map<string, { birthDate: string; gender: string }>();
  if (process.env.DATABASE_URL) {
    const memberships = await prisma.membership.findMany({
      where: { tenantId: tenant.id },
      include: { user: true, plan: true },
      orderBy: { startsAt: "desc" },
    });
    for (const m of memberships) {
      const cur = best.get(m.userId);
      if (!cur || RANK[m.status] < RANK[cur.status]) {
        best.set(m.userId, {
          status: m.status, planName: m.plan.name, planId: m.plan.id, stripeCustomerId: m.user.stripeCustomerId,
          startsAt: m.startsAt, endsAt: m.endsAt, paidAt: m.paidAt, pricePaid: m.pricePaid == null ? null : Number(m.pricePaid),
        });
      }
    }
  }

  if (process.env.DATABASE_URL) {
    const users = await prisma.user.findMany({
      where: { tenantUsers: { some: { tenantId: tenant.id } } },
      select: { id: true, birthDate: true, gender: true },
    });
    for (const u of users) profile.set(u.id, { birthDate: u.birthDate?.toISOString().slice(0, 10) ?? "", gender: u.gender ?? "" });
  }

  const rows: MemberRow[] = members
    // guest checkouts create GUEST users; keep them only if they bought a membership
    .filter((m) => m.role !== "PLATFORM_ADMIN" && (m.role !== "GUEST" || best.has(m.id)))
    .map((m) => {
      const ms = best.get(m.id);
      return {
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        plan: ms?.planName ?? "Keine Mitgliedschaft",
        state: ms?.status === "ACTIVE" ? "paid" : ms?.status === "PENDING" ? "invoice" : "remind",
        stripeCustomerId: ms?.status === "PENDING" ? ms.stripeCustomerId : null,
        role: m.role,
        phone: m.phone ?? "",
        birthDate: profile.get(m.id)?.birthDate ?? "",
        gender: profile.get(m.id)?.gender ?? "",
        planId: ms && (ms.status === "ACTIVE" || ms.status === "PENDING") ? ms.planId : "",
        planStatus: ms?.status ?? null,
        planStart: ms?.startsAt.toISOString() ?? "",
        planEnd: ms?.endsAt?.toISOString() ?? "",
        paidAt: ms?.paidAt?.toISOString() ?? "",
        pricePaid: ms?.pricePaid ?? null,
      };
    });

  return (
    <>
      <div className="flex items-end justify-between gap-3 px-5 pt-[66px] lg:pt-12">
        <div>
          <h1 className="text-[34px] font-bold tracking-[-.035em]">Mitglieder</h1>
          <div className="mt-0.5 text-[15px] text-muted-foreground">Abos & Zahlungen</div>
        </div>
        <ImportMembers slug={tenant.slug} />
      </div>
      <AdminMembers slug={tenant.slug} tenantId={tenant.id} members={rows} plans={plans.map((p) => ({ id: p.id, name: p.name, price: p.price }))} />
    </>
  );
}
