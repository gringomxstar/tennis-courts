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
        await handlePaymentSuccess(invoice.customer as string);
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
async function handlePaymentSuccess(stripeCustomerId: string, sessionMetadata?: Record<string, string>) {
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

  // 1. Wenn wir planId im Metadata haben, erstellen wir das aktive Abo
  if (sessionMetadata?.planId && sessionMetadata?.tenantId) {
    await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: sessionMetadata.tenantId,
        membershipPlanId: sessionMetadata.planId,
        startsAt: new Date(),
        status: "ACTIVE"
      }
    });
  } else {
    // 1b. Für normale Invoices (Offline Zahlung) aktualisieren wir bestehende PENDING Abos
    await prisma.membership.updateMany({
      where: { userId: user.id, status: { in: ["PENDING", "EXPIRED"] } },
      data: { status: "ACTIVE" }
    });
  }

  // 2. User-Rolle im Club auf MEMBER hochstufen
  if (user.tenantUsers.length > 0) {
    await prisma.tenantUser.update({
      where: { id: user.tenantUsers[0].id },
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

  // 1. Abonnement auf EXPIRED / PENDING setzen
  if (subscriptionId) {
    await prisma.membership.updateMany({
      where: { 
        userId: user.id,
        stripeSubscriptionId: subscriptionId
      },
      data: { status: "EXPIRED" }
    });
  }

  // 2. User-Rolle im Club zurück auf GUEST setzen
  if (user.tenantUsers.length > 0) {
    await prisma.tenantUser.update({
      where: { id: user.tenantUsers[0].id },
      data: { role: "GUEST" } // Muss wieder für Plätze bezahlen
    });
  }
}
