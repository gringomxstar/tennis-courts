import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * Gast-Platzbuchung bezahlt: Buchung von PENDING/UNPAID auf CONFIRMED/PAID heben.
 * Atomarer, idempotenter Guard (WHERE paymentStatus != PAID), damit Webhook-Retries
 * und der Abgleich beim Seitenaufruf sich nicht in die Quere kommen.
 */
export async function markBookingPaid(bookingId: string, stripeSessionId: string) {
  const result = await prisma.booking.updateMany({
    where: { id: bookingId, paymentStatus: { not: "PAID" } },
    data: { status: "CONFIRMED", paymentStatus: "PAID", stripeSessionId },
  });
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
