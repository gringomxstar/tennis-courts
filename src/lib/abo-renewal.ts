import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { grantMembership, grantPartnerMembership, type Partner } from "@/lib/membership";
import { sendMail, sendRenewalReminder } from "@/lib/mail";

// Auto-renewal state lives on the Stripe customer (metadata + default card): no extra DB columns.
const key = (tenantId: string) => `autorenew_${tenantId}`;
const partnerKey = (tenantId: string) => `autorenew_partner_${tenantId}`;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Checkout paid with "automatisch verlängern": keep the card as default and remember the plan. */
export async function rememberAutoRenew(session: Stripe.Checkout.Session) {
  const m = session.metadata ?? {};
  if (!session.customer || !m.tenantId || !m.planId) return;
  const stripe = getStripe();
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const pi = piId ? await stripe.paymentIntents.retrieve(piId) : null;
  const pm = typeof pi?.payment_method === "string" ? pi.payment_method : pi?.payment_method?.id;
  if (!pm) return;
  const partner = m.partnerEmail ? JSON.stringify({ email: m.partnerEmail, firstName: m.partnerFirstName ?? "", lastName: m.partnerLastName ?? "" }) : "";
  await stripe.customers.update(session.customer as string, {
    invoice_settings: { default_payment_method: pm },
    metadata: { [key(m.tenantId)]: m.planId, [partnerKey(m.tenantId)]: partner },
  });
}

export async function autoRenewPlanId(customerId: string | null | undefined, tenantId: string) {
  if (!customerId) return null;
  const c = await getStripe().customers.retrieve(customerId);
  return c.deleted ? null : c.metadata?.[key(tenantId)] || null;
}

/** "Automatisch verlängern" off (Stripe deletes metadata keys set to ""). */
export async function stopAutoRenew(customerId: string, tenantId: string) {
  await getStripe().customers.update(customerId, { metadata: { [key(tenantId)]: "", [partnerKey(tenantId)]: "" } });
}

const DAY = 86_400_000;

/**
 * Daily cron: 14 days before the season end, remind everyone without auto-renewal; within the last
 * 3 days, charge the saved card of auto-renewers (off-session). Idempotent per membership.
 */
export async function runAboRenewals(now = new Date()) {
  const ending = await prisma.membership.findMany({
    where: { status: "ACTIVE", endsAt: { gt: now, lte: new Date(now.getTime() + 14 * DAY) } },
    include: { user: true, plan: true, tenant: true },
  });
  const done = { reminded: 0, renewed: 0, failed: 0 };
  for (const m of ending) {
    // already renewed for next season?
    const next = await prisma.membership.count({ where: { userId: m.userId, tenantId: m.tenantId, status: "ACTIVE", startsAt: { gte: m.endsAt! } } });
    if (next) continue;
    const planId = await autoRenewPlanId(m.user.stripeCustomerId, m.tenantId).catch(() => null);
    const plan = planId ? await prisma.membershipPlan.findFirst({ where: { id: planId, status: "ACTIVE" } }) : null;

    if (plan && m.endsAt!.getTime() - now.getTime() <= 3 * DAY) {
      try {
        const stripe = getStripe();
        const customer = (await stripe.customers.retrieve(m.user.stripeCustomerId!)) as Stripe.Customer;
        const pm = customer.invoice_settings?.default_payment_method as string | null;
        if (!pm) throw new Error("no saved card");
        const pi = await stripe.paymentIntents.create(
          {
            amount: Math.round(Number(plan.price) * 100),
            currency: plan.currency.toLowerCase(),
            customer: customer.id,
            payment_method: pm,
            off_session: true,
            confirm: true,
            description: `${plan.name}, Saison-Verlängerung ${m.tenant.name}`,
            metadata: { planId: plan.id, tenantId: m.tenantId, userId: m.userId, renewal: "1" },
          },
          { idempotencyKey: `renew-${m.id}` }
        );
        if (pi.status !== "succeeded") throw new Error(`payment ${pi.status}`);
        await grantMembership(m.tenantId, m.userId, plan.id, pi.id);
        const partner = customer.metadata?.[partnerKey(m.tenantId)];
        if (partner) await grantPartnerMembership(m.tenantId, plan.id, JSON.parse(partner) as Partner, pi.id);
        await sendMail(m.user.email, `Abo verlängert: ${m.tenant.name}`, [
          `Hallo ${m.user.firstName}`, "",
          `dein Abo «${plan.name}» wurde automatisch um eine Saison verlängert (CHF ${Number(plan.price)}).`,
          `Automatische Verlängerung ausschalten: ${appUrl()}/c/${m.tenant.slug}/abos`,
        ].join("\n"));
        done.renewed++;
        continue;
      } catch (e) {
        console.error(`Auto-Verlängerung ${m.id} fehlgeschlagen:`, e);
        done.failed++;
        // fall through to the reminder so the member can pay by hand
      }
    } else if (plan) continue; // auto-renewer, not due yet

    // one reminder per membership (AuditLog as the "sent" marker)
    const sent = await prisma.auditLog.count({ where: { action: "ABO_REMINDER", entityId: m.id } });
    if (sent) continue;
    const ok = await sendRenewalReminder(m.user.email, m.user.firstName, m.plan.name, m.membershipPlanId, m.endsAt!, m.tenant.name, m.tenant.slug);
    if (ok) {
      await prisma.auditLog.create({ data: { tenantId: m.tenantId, action: "ABO_REMINDER", entityType: "Membership", entityId: m.id } });
      done.reminded++;
    }
  }
  return done;
}
