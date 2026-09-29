import { getTenantContext } from "@/lib/tenant";
import { getMembershipPlansByTenantId } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { isPartnerRow, seasonEnd } from "@/lib/membership";
import { autoRenewPlanId } from "@/lib/abo-renewal";
import { DINER_DEFAULT } from "@/lib/pricing";
import { playWindowLabel } from "@/lib/booking-rules";
import { AbosView } from "@/components/app/abos-view";

const DAY = 86_400_000;
// formatted here so server and client render the same string
const date = (d: Date) => d.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric" });

export default async function AbosPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const [{ clubSlug }, { plan }] = await Promise.all([params, searchParams]);
  const { tenant, user } = await getTenantContext(clubSlug);
  const now = new Date();
  const [plans, rows, u] = await Promise.all([
    getMembershipPlansByTenantId(tenant.id),
    user && process.env.DATABASE_URL
      ? prisma.membership
          .findMany({
            where: { userId: user.id, tenantId: tenant.id, status: { in: ["ACTIVE", "PENDING"] }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            include: { plan: true },
            orderBy: { startsAt: "asc" },
          })
          .catch(() => [])
      : [],
    user && process.env.DATABASE_URL
      ? prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } }).catch(() => null)
      : null,
  ]);
  const active = rows.filter((m) => m.status === "ACTIVE");
  const current = active.find((m) => m.startsAt <= now);
  const renewal = current?.endsAt ? active.find((m) => m.startsAt >= current.endsAt!) : undefined;
  const pending = !current && rows.find((m) => m.status === "PENDING");
  const autoRenew = current ? Boolean(await autoRenewPlanId(u?.stripeCustomerId, tenant.id).catch(() => null)) : false;

  const s = tenant.settingsJson;
  const diner = s?.dinerTennis ?? DINER_DEFAULT;
  return (
    <AbosView
      slug={tenant.slug}
      clubName={tenant.name}
      loggedIn={!!user}
      plans={plans.filter((p) => p.price > 0) /* the free "Gast" plan is not an Abo */}
      initialPlan={plan}
      guestRate={s?.defaultHourlyRateTennis ?? 30}
      guestRatePadel={s?.defaultHourlyRatePadel ?? 40}
      guestFee={s?.guestFee ?? 15}
      invoice={Boolean(s?.payByInvoice && s.invoiceIban)}
      seasonYear={seasonEnd(now).getUTCFullYear()}
      dinerLabel={diner.enabled ? playWindowLabel(diner) : null}
      membership={
        current
          ? {
              planId: current.membershipPlanId,
              name: current.plan.name,
              validity: current.endsAt ? `Gültig bis ${date(current.endsAt)}` : "Unbefristet",
              renewal: renewal?.endsAt ? `Verlängert bis ${date(renewal.endsAt)}` : null,
              autoRenew,
              // Paar-Abo partner: the buyer renews for both
              renewDue: !renewal && !isPartnerRow(current) && !!current.endsAt && current.endsAt.getTime() - now.getTime() < 60 * DAY,
            }
          : pending
            ? { planId: pending.membershipPlanId, name: pending.plan.name, validity: "Zahlung ausstehend", renewal: null, autoRenew: false, renewDue: false }
            : null
      }
    />
  );
}
