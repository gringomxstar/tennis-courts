import { getTenantContext, type TenantContext } from "@/lib/tenant";
import { getMembershipPlansByTenantId, getUserWallet } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/app/profile-view";

/** Membership query mirrors the old dashboard, scoped to the tenant. */
async function loadProfile(ctx: TenantContext) {
  const { tenant, user } = ctx;
  if (!user) return { wallet: 0, plans: [], membership: null };
  const [wallet, plans, m] = await Promise.all([
    getUserWallet(tenant.id, user.id),
    getMembershipPlansByTenantId(tenant.id),
    process.env.DATABASE_URL
      ? prisma.membership
          .findFirst({
            where: { userId: user.id, tenantId: tenant.id, status: { in: ["ACTIVE", "PENDING"] } },
            include: { plan: true },
            orderBy: { startsAt: "desc" },
          })
          .catch(() => null)
      : null,
  ]);
  return {
    wallet: wallet.balance,
    plans,
    membership: m
      ? {
          planId: m.membershipPlanId,
          name: m.plan.name,
          price: Number(m.plan.price),
          // formatted here so server and client render the same string
          validity:
            m.status === "PENDING"
              ? "Zahlung ausstehend"
              : m.endsAt
                ? `Gültig bis ${m.endsAt.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric" })}`
                : "Unbefristet",
        }
      : null,
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ abo?: string }>;
}) {
  const [{ clubSlug }, { abo }] = await Promise.all([params, searchParams]);
  const ctx = await getTenantContext(clubSlug);
  const data = await loadProfile(ctx);
  return (
    <ProfileView
      slug={ctx.tenant.slug}
      clubName={ctx.tenant.name}
      user={ctx.user && { name: ctx.user.name || ctx.user.email }}
      canAdmin={ctx.isTenantAdmin}
      admin={false}
      openAbo={abo === "1"}
      {...data}
    />
  );
}
