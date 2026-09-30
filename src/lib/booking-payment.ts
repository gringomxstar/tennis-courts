import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation } from "@/lib/mail";

/**
 * Gast-Platzbuchung bezahlt: Buchung von PENDING/UNPAID auf CONFIRMED/PAID heben.
 * Atomarer, idempotenter Guard (WHERE paymentStatus != PAID), damit Webhook-Retries
 * und der Abgleich beim Seitenaufruf sich nicht in die Quere kommen.
 */
export async function markBookingPaid(bookingId: string, stripeSessionId: string) {
  const result = await prisma.booking.updateMany({
    where: { id: bookingId, paymentStatus: { not: "PAID" }, status: { not: "CANCELLED" } },
    data: { status: "CONFIRMED", paymentStatus: "PAID", stripeSessionId },
  });
  // Nur beim tatsächlichen Übergang senden — Webhook-Retries/Abgleich lösen keine Doppel-Mail aus.
  if (result.count > 0) await sendBookingConfirmation(bookingId);
  else {
    // Bezahlt, nachdem die Buchung storniert/abgelaufen war: Geld zurück statt behalten.
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (b?.status === "CANCELLED" && b.paymentStatus !== "PAID") {
      await refundStripeBooking(stripeSessionId).catch((e) => console.error(`Rückerstattung ${bookingId}:`, e));
    }
  }
  return result.count > 0;
}

/** Checkout nicht bezahlt/abgelaufen — Slot wieder freigeben, sofern noch PENDING. */
export async function releaseUnpaidBooking(bookingId: string) {
  const result = await prisma.booking.updateMany({
    where: { id: bookingId, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  return result.count > 0;
}

/** Back from Checkout via "Zurück": end the Stripe session and free the slot right away (not after 30 min). */
export async function abandonCheckout(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, stripeSessionId: true } });
  if (b?.status !== "PENDING" || !b.stripeSessionId) return false;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(b.stripeSessionId);
  if (session.payment_status === "paid") {
    await markBookingPaid(bookingId, session.id);
    return false;
  }
  if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
  return releaseUnpaidBooking(bookingId);
}

/**
 * Offene Stripe-Buchungen direkt bei Stripe abgleichen. Der Webhook bleibt der Hauptweg,
 * aber ohne (oder mit falsch konfiguriertem) Webhook blieben bezahlte Buchungen sonst
 * für immer auf "Wartet auf Zahlung" stehen.
 */
export async function syncPendingBookingPayments(tenantId: string) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.DATABASE_URL) return;

  const pending = await prisma.booking
    .findMany({
      where: { tenantId, status: "PENDING", stripeSessionId: { not: null } },
      select: { id: true, stripeSessionId: true },
      take: 50,
    })
    .catch(() => []);

  await Promise.all(
    pending.map(async (b) => {
      try {
        const session = await getStripe().checkout.sessions.retrieve(b.stripeSessionId!);
        if (session.metadata?.bookingId !== b.id) return;
        if (session.payment_status === "paid") await markBookingPaid(b.id, session.id);
        else if (session.status === "expired") await releaseUnpaidBooking(b.id);
      } catch (e) {
        console.error(`Stripe-Abgleich für Buchung ${b.id} fehlgeschlagen:`, e);
      }
    })
  );
}

/** Refund a booking paid through Stripe Checkout. Returns the refunded CHF amount (0 if nothing was paid). */
export async function refundStripeBooking(stripeSessionId: string) {
  const stripe = getStripe();
  const s = await stripe.checkout.sessions.retrieve(stripeSessionId);
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
  if (!pi || s.payment_status !== "paid") return 0;
  await stripe.refunds.create({ payment_intent: pi }, { idempotencyKey: `refund-${stripeSessionId}` });
  await prisma.booking.updateMany({ where: { stripeSessionId, refundedAt: null }, data: { refundedAt: new Date() } });
  return (s.amount_total ?? 0) / 100;
}
