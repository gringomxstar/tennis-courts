import { getTenantContext } from "@/lib/tenant";
import { getMembershipPlansByTenantId } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { AbosView } from "@/components/app/abos-view";

export default async function AbosPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const [{ clubSlug }, { plan }] = await Promise.all([params, searchParams]);
  const { tenant, user } = await getTenantContext(clubSlug);
  const [plans, m] = await Promise.all([
    getMembershipPlansByTenantId(tenant.id),
    user && process.env.DATABASE_URL
      ? prisma.membership
          .findFirst({
            where: { userId: user.id, tenantId: tenant.id, status: { in: ["ACTIVE", "PENDING"] } },
            include: { plan: true },
            orderBy: { startsAt: "desc" },
          })
          .catch(() => null)
      : null,
  ]);
  const s = tenant.settingsJson;
  return (
    <AbosView
      slug={tenant.slug}
      clubName={tenant.name}
      loggedIn={!!user}
      plans={plans.filter((p) => p.price > 0) /* the free "Gast" plan is not an Abo */}
      initialPlan={plan}
      guestRate={s?.defaultHourlyRateTennis ?? 30}
      invoice={Boolean(s?.payByInvoice)}
      membership={
        m && {
          planId: m.membershipPlanId,
          name: m.plan.name,
          // formatted here so server and client render the same string
          validity:
            m.status === "PENDING"
              ? "Zahlung ausstehend"
              : m.endsAt
                ? `Gültig bis ${m.endsAt.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric" })}`
                : "Unbefristet",
        }
      }
    />
  );
}
