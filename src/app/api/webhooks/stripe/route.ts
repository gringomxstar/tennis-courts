import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { seasonEnd, grantMembership, grantPartnerMembership } from "@/lib/membership";
import { rememberAutoRenew } from "@/lib/abo-renewal";
import { markBookingPaid, releaseUnpaidBooking } from "@/lib/booking-payment";
import { creditTopUpSession } from "@/lib/wallet";

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
    event = getStripe().webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`❌ Webhook Error: ${message}`);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      // 1. Sofortzahlung (Twint, Kreditkarte, Apple Pay)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.purpose === "wallet_topup") {
          await creditTopUpSession(session.id);
        } else if (session.metadata?.bookingId) {
          await handleBookingPaymentSuccess(session.metadata.bookingId, session.id);
        } else {
          await handlePaymentSuccess(session.customer as string, session.metadata as Record<string, string>, session.id);
          if (session.metadata?.autoRenew === "1") await rememberAutoRenew(session);
        }
        break;
      }

      // 1b. Checkout-Session (Platzbuchung) ohne Zahlung abgelaufen — Slot wieder freigeben
      case "checkout.session.expired": {
        const expiredSession = event.data.object as Stripe.Checkout.Session;
        if (expiredSession.metadata?.bookingId) {
          await handleBookingCheckoutExpired(expiredSession.metadata.bookingId);
        }
        break;
      }

      // 2. Kauf auf Rechnung bezahlt (Bank Transfer / E-Banking via QR-Code)
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSuccess(invoice.customer as string, invoice.metadata as Record<string, string>, invoice.id);
        break;
      }

      // 3. Rechnung abgelaufen / Nicht bezahlt
      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = failedInvoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
        await handlePaymentFailed(failedInvoice.customer as string, subscriptionId);
        break;
      }

      default:
        console.log(`🤷‍♂️ Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleBookingPaymentSuccess(bookingId: string, stripeSessionId: string) {
  if (await markBookingPaid(bookingId, stripeSessionId)) {
    console.log(`✅ Buchung ${bookingId} bezahlt und bestätigt.`);
  }
}

async function handleBookingCheckoutExpired(bookingId: string) {
  if (await releaseUnpaidBooking(bookingId)) {
    console.log(`⌛ Checkout für Buchung ${bookingId} abgelaufen, Slot freigegeben.`);
  }
}

/**
 * Auto-Unlock Logic: Wird gefeuert, sobald Geld eingegangen ist
 * (Egal ob Twint in 2 Sekunden, oder E-Banking nach 14 Tagen)
 */
async function handlePaymentSuccess(stripeCustomerId: string, metadata?: Record<string, string>, ref?: string) {
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
    await grantMembership(tenantId, user.id, metadata.planId, ref);
    if (metadata.partnerEmail) {
      await grantPartnerMembership(tenantId, metadata.planId, {
        email: metadata.partnerEmail,
        firstName: metadata.partnerFirstName ?? "",
        lastName: metadata.partnerLastName ?? "",
      }, ref);
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
        data: { status: "ACTIVE", startsAt: new Date(), endsAt: seasonEnd() }
      });
    } else if (distinctTenants.size > 1) {
      console.error(`Ambiguous tenant for invoice payment, user ${user.id} has pending memberships in multiple tenants — skipping auto-activation.`);
      return;
    }
  }

  if (!tenantId) return;

  // 2. User-Rolle im Club auf MEMBER hochstufen (nur im verifizierten Tenant, nur von GUEST — Admins bleiben Admins)
  await prisma.tenantUser.updateMany({ where: { tenantId, userId: user.id, role: "GUEST" }, data: { role: "MEMBER" } });
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
