import { getTenantContext, type TenantContext } from "@/lib/tenant";
import { getUserClubs, getUserWallet } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/app/profile-view";
import { creditTopUpSession } from "@/lib/wallet";

/** Membership query mirrors the old dashboard, scoped to the tenant. */
async function loadProfile(ctx: TenantContext) {
  const { tenant, user } = ctx;
  const support = { email: tenant.email, phone: tenant.phone };
  if (!user) return { wallet: 0, membership: null, profile: null, support, clubs: [] };
  const [wallet, m, me, clubs] = await Promise.all([
    getUserWallet(tenant.id, user.id),
    process.env.DATABASE_URL
      ? prisma.membership
          .findFirst({
            where: { userId: user.id, tenantId: tenant.id, status: { in: ["ACTIVE", "PENDING"] } },
            include: { plan: true },
            orderBy: { startsAt: "desc" },
          })
          .catch(() => null)
      : null,
    process.env.DATABASE_URL ? prisma.user.findUnique({ where: { id: user.id } }).catch(() => null) : null,
    getUserClubs(user.id),
  ]);
  return {
    support,
    clubs,
    profile: me ? { firstName: me.firstName, lastName: me.lastName, phone: me.phone ?? "" } : null,
    wallet: wallet.balance,
    membership: m
      ? {
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
  searchParams: Promise<{ topup?: string; register?: string; next?: string }>;
}) {
  const [{ clubSlug }, { topup, register, next }] = await Promise.all([params, searchParams]);
  const ctx = await getTenantContext(clubSlug);
  // back from Stripe: credit right away instead of waiting for the webhook (idempotent)
  if (topup && ctx.user) await creditTopUpSession(topup).catch((e) => console.error("Top-up-Abgleich:", e));
  const data = await loadProfile(ctx);
  return (
    <ProfileView
      slug={ctx.tenant.slug}
      clubName={ctx.tenant.name}
      user={ctx.user && { name: ctx.user.name || ctx.user.email }}
      admin={false}
      openRegister={register === "1"}
      next={next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : undefined}
      {...data}
    />
  );
}
