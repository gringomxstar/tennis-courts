import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma"; // Assuming standard prisma export

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_fallback_so_build_does_not_crash", {
  apiVersion: "2026-08-26.dahlia",
});

// This secret is found in the Stripe Dashboard -> Developers -> Webhooks
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (!endpointSecret || !signature) {
      console.warn("⚠️  Stripe Webhook Secret or Signature missing.");
      return NextResponse.json({ error: "Missing secret or signature" }, { status: 400 });
    }
    // Verify that this request actually came from Stripe
    event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      // 1. Sofortzahlung (Twint, Kreditkarte, Apple Pay)
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;
        await handlePaymentSuccess(session.customer as string, session.metadata as Record<string, string>);
        break;

      // 2. Kauf auf Rechnung bezahlt (Bank Transfer / E-Banking via QR-Code)
      case "invoice.paid":
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSuccess(invoice.customer as string, invoice.metadata as Record<string, string>);
        break;

      // 3. Rechnung abgelaufen / Nicht bezahlt
      case "invoice.payment_failed":
        const failedInvoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(failedInvoice.customer as string, (failedInvoice as any).subscription as string);
        break;

      default:
        console.log(`🤷‍♂️ Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/**
 * Auto-Unlock Logic: Wird gefeuert, sobald Geld eingegangen ist 
 * (Egal ob Twint in 2 Sekunden, oder E-Banking nach 14 Tagen)
 */
async function handlePaymentSuccess(stripeCustomerId: string, metadata?: Record<string, string>) {
  if (!stripeCustomerId) return;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId },
    include: { tenantUsers: true }
  });

  if (!user) {
    console.error(`User for Stripe Customer ${stripeCustomerId} not found.`);
    return;
  }

  console.log(`✅ Zahlung erfolgreich für ${user.email}. Schalte Abo frei.`);

  // Tenant muss immer aus verifizierten Metadaten kommen — niemals aus tenantUsers[0] raten
  let tenantId = metadata?.tenantId;

  // 1. Wenn wir planId im Metadata haben, erstellen wir das aktive Abo (idempotent bei Webhook-Retries)
  if (metadata?.planId && tenantId) {
    const existing = await prisma.membership.findFirst({
      where: { userId: user.id, tenantId, membershipPlanId: metadata.planId, status: { in: ["ACTIVE", "PENDING"] } }
    });
    if (!existing) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          tenantId,
          membershipPlanId: metadata.planId,
          startsAt: new Date(),
          status: "ACTIVE"
        }
      });
    } else if (existing.status === "PENDING") {
      await prisma.membership.update({ where: { id: existing.id }, data: { status: "ACTIVE" } });
    }
  } else {
    // 1b. Für normale Invoices (Offline Zahlung) ohne Tenant-Metadata: nur eindeutig zuordenbare Fälle freischalten
    const pending = await prisma.membership.findMany({
      where: { userId: user.id, status: { in: ["PENDING", "EXPIRED"] } }
    });
    const distinctTenants = new Set(pending.map(m => m.tenantId));
    if (distinctTenants.size === 1) {
      tenantId = pending[0].tenantId;
      await prisma.membership.updateMany({
        where: { userId: user.id, tenantId, status: { in: ["PENDING", "EXPIRED"] } },
        data: { status: "ACTIVE" }
      });
    } else if (distinctTenants.size > 1) {
      console.error(`Ambiguous tenant for invoice payment, user ${user.id} has pending memberships in multiple tenants — skipping auto-activation.`);
      return;
    }
  }

  if (!tenantId) return;

  // 2. User-Rolle im Club auf MEMBER hochstufen (nur im verifizierten Tenant)
  const tenantUser = user.tenantUsers.find(tu => tu.tenantId === tenantId);
  if (tenantUser) {
    await prisma.tenantUser.update({
      where: { id: tenantUser.id },
      data: { role: "MEMBER" }
    });
  }
}

/**
 * Auto-Lock Logic: Wenn eine Rechnung nach Mahnung nicht bezahlt wird
 */
async function handlePaymentFailed(stripeCustomerId: string, subscriptionId?: string) {
  if (!stripeCustomerId) return;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId },
    include: { tenantUsers: true }
  });

  if (!user) return;

  console.log(`❌ Zahlung gescheitert für ${user.email}. Sperre Abo.`);

  if (!subscriptionId) return;

  // 1. Abonnement auf EXPIRED setzen und dessen Tenant ermitteln (nie raten via tenantUsers[0])
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, stripeSubscriptionId: subscriptionId }
  });
  if (!membership) return;

  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "EXPIRED" }
  });

  // 2. User-Rolle im betroffenen Club zurück auf GUEST setzen
  const tenantUser = user.tenantUsers.find(tu => tu.tenantId === membership.tenantId);
  if (tenantUser) {
    await prisma.tenantUser.update({
      where: { id: tenantUser.id },
      data: { role: "GUEST" } // Muss wieder für Plätze bezahlen
    });
  }
}
