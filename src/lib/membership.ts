import { prisma } from "@/lib/prisma";
import { passwordLink } from "@/lib/booking-link";
import { sendPasswordLink } from "@/lib/mail";

const zurichYear = new Intl.DateTimeFormat("en", { timeZone: "Europe/Zurich", year: "numeric" });

/**
 * Abos run for the season, 1 April – 31 March (club time). A purchase ends on 31 March 23:59:59 Zurich
 * of the following year: from 1 January on it counts for the coming season (club rule, no Abo for just
 * a few weeks); renewing an active Abo appends the following season.
 */
export function seasonEnd(from: Date = new Date()): Date {
  // 1 April is always summer time (DST starts on the last Sunday of March): 31.3. 23:59:59 = 21:59:59 UTC
  return new Date(Date.UTC(Number(zurichYear.format(from)) + 1, 2, 31, 21, 59, 59));
}

export type Partner = { firstName: string; lastName: string; email: string };

/** Paar-Abo form input → normalized partner, or an error text for the buyer. */
export function parsePartner(raw: unknown, buyerEmail: string): Partner | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const firstName = String(r.firstName ?? "").trim().slice(0, 80);
  const lastName = String(r.lastName ?? "").trim().slice(0, 80);
  const email = String(r.email ?? "").trim().toLowerCase();
  if (!firstName || !/^\S+@\S+\.\S+$/.test(email)) return "Bitte gib Vorname und E-Mail der zweiten Person an.";
  if (email === buyerEmail.toLowerCase()) return "Die zweite Person braucht eine eigene E-Mail-Adresse.";
  return { firstName, lastName, email };
}

/**
 * Paid Abo: ACTIVE membership until the season end, role GUEST → MEMBER (other roles untouched).
 * With an Abo still running (renewal before 31 March) the new one starts when it ends, unless it
 * replaces it now: `switchNow` (admin changes the plan) or an open invoice that was ordered for now.
 * The replaced Abo ends as EXPIRED so its revenue stays in the stats.
 * `ref` (Stripe session/payment id) makes webhook retries and the renewal cron idempotent.
 */
export async function grantMembership(tenantId: string, userId: string, planId: string, ref?: string, pricePaid?: number, switchNow = false) {
  if (ref && (await prisma.membership.findUnique({ where: { stripeSubscriptionId: ref } }))) return;
  const now = new Date();
  const pending = await prisma.membership.findFirst({ where: { userId, tenantId, membershipPlanId: planId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  const replace = switchNow || (pending != null && pending.startsAt <= now);
  const running = await prisma.membership.findFirst({
    // replacing: only the Abo that runs today (a renewed next season stays); appending: after the last one
    where: { userId, tenantId, status: "ACTIVE", endsAt: { gt: now }, ...(replace ? { startsAt: { lte: now } } : {}) },
    orderBy: { endsAt: "desc" },
  });
  if (replace && running) await prisma.membership.update({ where: { id: running.id }, data: { status: "EXPIRED", endsAt: now } });
  const startsAt = !replace && running?.endsAt ? new Date(running.endsAt.getTime() + 1000) : now;
  // price snapshot for the stats (an open invoice keeps its own, e.g. 0 for a Paar-Abo partner); the plan price may change later
  const price =
    pricePaid ??
    (pending?.pricePaid != null ? Number(pending.pricePaid) : Number((await prisma.membershipPlan.findUnique({ where: { id: planId }, select: { price: true } }))?.price ?? 0));
  const data = {
    status: "ACTIVE" as const,
    startsAt,
    endsAt: seasonEnd(startsAt),
    // an open invoice keeps its reference (links a Paar-Abo buyer and partner: ref / ref:partner)
    stripeSubscriptionId: ref ?? pending?.stripeSubscriptionId ?? null,
    pricePaid: price,
    paidAt: new Date(),
  };
  const { id } = pending
    ? await prisma.membership.update({ where: { id: pending.id }, data })
    : await prisma.membership.create({ data: { userId, tenantId, membershipPlanId: planId, ...data } });
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: { tenantId, userId, role: "MEMBER" },
    update: {},
  });
  await prisma.tenantUser.updateMany({ where: { tenantId, userId, role: "GUEST" }, data: { role: "MEMBER" } });
  return id; // undefined on a webhook retry (already granted)
}

/** Second person of a Paar-Abo: got it for free with the buyer's purchase, so the buyer renews it, not the partner. */
export const isPartnerRow = (m: { pricePaid: unknown; plan: { rulesJson: unknown } }) =>
  m.pricePaid != null && Number(m.pricePaid) === 0 && (m.plan.rulesJson as { persons?: number } | null)?.persons === 2;

/** Second person of a Paar-Abo: find or create (no password), grant the same Abo, invite by mail. */
export async function grantPartnerMembership(tenantId: string, planId: string, p: Partner, ref?: string) {
  const user =
    (await prisma.user.findUnique({ where: { email: p.email } })) ??
    (await prisma.user.create({ data: { email: p.email, firstName: p.firstName, lastName: p.lastName, passwordHash: null } }));
  // the buyer's membership carries the Paar-Abo price
  await grantMembership(tenantId, user.id, planId, ref && `${ref}:partner`, 0);
  if (!user.passwordHash) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } });
    if (tenant) await sendPasswordLink(user.email, user.firstName, tenant.name, passwordLink(tenant.slug, user.id, null), "invite");
  }
}
