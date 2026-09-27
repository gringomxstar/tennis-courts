import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import {
  getCourtsByTenantId,
  getCourtBookings,
  getCourtBlocks,
  getTenantMembers,
  getUserWallet,
} from "@/lib/data";
import { Navbar } from "@/components/navbar";
import { CourtCalendar } from "@/components/calendar/court-calendar";

interface ClubPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function ClubPage({ params, searchParams }: ClubPageProps) {
  const { clubSlug } = await params;
  const { date: rawDate } = await searchParams;
  const context = await getTenantContext(clubSlug);

  if (!context || !context.tenant) {
    notFound();
  }

  const tenant = context.tenant;
  const todayStr = new Date().toISOString().split("T")[0];
  const selectedDateStr =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayStr;

  // Fetch courts, bookings, court blocks, members, and user wallet
  const [courts, bookings, courtBlocks, members, wallet] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getCourtBookings(tenant.id, selectedDateStr),
    getCourtBlocks(tenant.id, selectedDateStr),
    getTenantMembers(tenant.id),
    context.user?.id ? getUserWallet(tenant.id, context.user.id) : null,
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17]">
      <Navbar currentTenant={tenant} user={context.user} wallet={wallet} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CourtCalendar
          tenant={tenant}
          courts={courts}
          initialBookings={bookings}
          initialCourtBlocks={courtBlocks}
          members={members}
          currentUserId={context.user?.id}
          userWallet={wallet}
          isClubAdmin={context.isTenantAdmin}
          selectedDate={selectedDateStr}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 dark:border-white/[0.06] dark:bg-[#141A26] mt-12 text-xs text-slate-500 dark:text-slate-400 text-center">
        <p>
          {tenant.name} &bull; Betrieben mit{" "}
          <span className="font-semibold text-[#E25B36]">TennisCourts</span> Reservation OS
        </p>
      </footer>
    </div>
  );
}
