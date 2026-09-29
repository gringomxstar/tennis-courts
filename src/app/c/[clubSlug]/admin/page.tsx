import { requireTenantAdmin } from "@/lib/tenant";
import { getBlocksInRange, getBookingsInRange, getCourtsByTenantId } from "@/lib/data";
import { syncPendingBookingPayments } from "@/lib/booking-payment";
import { AdminToday } from "@/components/app/admin-today";
import { prisma } from "@/lib/prisma";

/** now-1d .. now+2d as ISO, wide enough for any client timezone's "today". */
function range() {
  const now = Date.now();
  return [new Date(now - 86_400_000).toISOString(), new Date(now + 2 * 86_400_000).toISOString()];
}

export default async function AdminTodayPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  await syncPendingBookingPayments(tenant.id);

  // server passes a wide ISO range; the client picks "today" in its local time
  const [from, to] = range();
  const [courts, bookings, blocks, unpaid] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getBookingsInRange(tenant.id, from, to),
    getBlocksInRange(tenant.id, from, to),
    process.env.DATABASE_URL
      ? prisma.booking.findMany({
          where: {
            tenantId: tenant.id,
            paymentMethod: { in: ["ON_SITE", "INVOICE"] },
            paymentStatus: "UNPAID",
            status: { in: ["CONFIRMED", "COMPLETED"] },
          },
          include: { organizer: true, court: true },
          orderBy: { startsAt: "asc" },
          take: 50,
        })
      : [],
  ]);

  return (
    <AdminToday
      slug={tenant.slug}
      settings={tenant.settingsJson}
      courts={courts.filter((c) => c.status === "ACTIVE")}
      bookings={bookings}
      blocks={blocks}
      openPayments={unpaid.map((b) => ({
        id: b.id,
        name: `${b.organizer.firstName} ${b.organizer.lastName}`.trim(),
        court: b.court.name,
        startsAt: b.startsAt.toISOString(),
        amount: Number(b.totalCost),
        method: b.paymentMethod === "INVOICE" ? "Rechnung" : "Vor Ort",
      }))}
    />
  );
}
