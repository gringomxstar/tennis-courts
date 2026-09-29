import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { claimableByBooking, verifyBookingToken } from "@/lib/booking-link";
import { abandonCheckout, syncPendingBookingPayments } from "@/lib/booking-payment";
import { GuestBookingCard } from "@/components/app/guest-booking-card";

/** Booking page for guests without an account, opened from the confirmation mail (token = login). */
export default async function GuestBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string; bookingId: string }>;
  searchParams: Promise<{ t?: string; paid?: string; abgebrochen?: string }>;
}) {
  const [{ clubSlug, bookingId }, { t, paid, abgebrochen }] = await Promise.all([params, searchParams]);
  if (!process.env.DATABASE_URL || !verifyBookingToken(bookingId, t)) notFound();

  let b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { court: true, tenant: true, organizer: true } });
  if (!b || b.tenant.slug !== clubSlug) notFound();
  const aborted = abgebrochen === "1" && b.status === "PENDING" && (await abandonCheckout(b.id).catch(() => false));
  if (b.status === "PENDING") {
    await syncPendingBookingPayments(b.tenantId);
    b = (await prisma.booking.findUnique({ where: { id: bookingId }, include: { court: true, tenant: true, organizer: true } }))!;
  }
  const minPlan = await prisma.membershipPlan.findFirst({
    where: { tenantId: b.tenantId, status: "ACTIVE", price: { gt: 0 } },
    orderBy: { price: "asc" },
    select: { price: true },
  });
  const deadline = (b.tenant.settingsJson as { cancellationDeadlineHours?: number } | null)?.cancellationDeadlineHours ?? 24;

  return (
    <GuestBookingCard
      token={t!}
      justPaid={paid === "1"}
      aborted={aborted}
      booking={{
        id: b.id,
        court: b.court.name,
        clubName: b.tenant.name,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        status: b.status,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        total: Number(b.totalCost),
        cancellableUntil: new Date(b.startsAt.getTime() - deadline * 3_600_000).toISOString(),
      }}
      supportEmail={b.tenant.email}
      slug={clubSlug}
      minPlanPrice={minPlan ? Number(minPlan.price) : null}
      account={
        b.organizer.passwordHash
          ? null
          : { email: b.organizer.email, claimable: await claimableByBooking(b.organizerId, b.id) }
      }
    />
  );
}
