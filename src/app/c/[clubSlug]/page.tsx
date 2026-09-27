import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import {
  getCourtsByTenantId,
  getCourtBookings,
  getCourtBlocks,
  getTenantMembers,
} from "@/lib/data";
import { Navbar } from "@/components/navbar";
import { CourtCalendar } from "@/components/calendar/court-calendar";

interface ClubPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubSlug } = await params;
  const context = await getTenantContext(clubSlug);

  if (!context || !context.tenant) {
    notFound();
  }

  const tenant = context.tenant;
  const todayStr = new Date().toISOString().split("T")[0];

  // Fetch courts, bookings, court blocks, and members
  const [courts, bookings, courtBlocks, members] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getCourtBookings(tenant.id, todayStr),
    getCourtBlocks(tenant.id, todayStr),
    getTenantMembers(tenant.id),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar currentTenant={tenant} user={context.user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CourtCalendar
          tenant={tenant}
          courts={courts}
          initialBookings={bookings}
          initialCourtBlocks={courtBlocks}
          members={members}
          currentUserId={context.user?.id}
          isClubAdmin={context.isTenantAdmin}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-900 mt-12 text-xs text-slate-500 text-center">
        <p>
          {tenant.name} &bull; Betrieben mit{" "}
          <span className="font-semibold text-emerald-600">TennisCourts</span> Reservation OS
        </p>
      </footer>
    </div>
  );
}
