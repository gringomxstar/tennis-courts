export const dynamic = "force-dynamic";
export const revalidate = 0;
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import {
  getCourtsByTenantId,
  getCourtBookings,
  getCourtBlocks,
  getTenantMembers,
  getUserWallet,
} from "@/lib/data";
import { CourtCalendar } from "@/components/calendar/court-calendar";
import {
  Calendar,
  Trophy,
  Shield,
  Home,
} from "lucide-react";

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

  const userDisplayName = context.user?.name || "Unbekannter Spieler";
  const userInitials = userDisplayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex bg-background text-foreground font-sans select-none">
      
      {/* ======================================================== */}
      {/* 1. LEFT NAVIGATION RAIL (Desktop - Image 1 Style)        */}
      {/* ======================================================== */}
      <aside className="hidden md:flex w-16 lg:w-20 shrink-0 border-r border-border bg-card flex-col items-center justify-between py-5 z-30 transition-colors">
        {/* Brand Emblem */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/"
            className="w-10 h-10 rounded-2xl bg-clay text-white flex items-center justify-center font-black text-lg shadow-lg shadow-clay/25 transition-transform hover:scale-105"
            title="Zur Startseite"
          >
            🎾
          </Link>

          {/* Navigation Rail Buttons */}
          <div className="flex flex-col items-center gap-3 mt-4">
            {/* Active Calendar Button */}
            <button
              type="button"
              className="w-11 h-11 rounded-2xl bg-clay text-white flex items-center justify-center shadow-lg shadow-clay/30 transition-all cursor-pointer"
              title="Court Kalender"
            >
              <Calendar className="w-5 h-5" />
            </button>

            <Link
              href={`/c/${tenant.slug}/bookings`}
              className="w-11 h-11 rounded-2xl bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              title="Meine Matches & Turniere"
            >
              <Trophy className="w-5 h-5" />
            </Link>

            {context.isTenantAdmin && (
              <Link
                href={`/c/${tenant.slug}/admin`}
                className="w-11 h-11 rounded-2xl bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                title="Club Verwaltung"
              >
                <Shield className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>

        {/* Bottom Profile / Settings */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl bg-secondary border border-border text-foreground font-extrabold text-xs flex items-center justify-center cursor-pointer shadow-md"
            title={userDisplayName}
          >
            {userInitials}
          </div>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MAIN VIEWPORT CANVAS (Edge-to-Edge 100% Fullscreen)   */}
      {/* ======================================================== */}
      <main className="flex-1 h-full min-h-0 overflow-hidden flex flex-col min-w-0">
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

      {/* ======================================================== */}
      {/* 3. MOBILE FLOATING BOTTOM DOCK (Image 2 Style)           */}
      {/* ======================================================== */}
      <nav className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-full bg-card/95 backdrop-blur-2xl border border-border shadow-[0_10px_35px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-center gap-7">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-0.5 text-[10px] font-bold"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </Link>
        <button
          type="button"
          className="text-clay flex flex-col items-center gap-0.5 text-[10px] font-bold"
        >
          <Calendar className="w-4 h-4" />
          <span>Kalender</span>
        </button>
        <Link
          href={`/c/${tenant.slug}/bookings`}
          className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-0.5 text-[10px] font-bold"
        >
          <Trophy className="w-4 h-4" />
          <span>Matches</span>
        </Link>
        <div className="w-6 h-6 rounded-full bg-clay text-white flex items-center justify-center text-[9px] font-black">
          {userInitials}
        </div>
      </nav>
    </div>
  );
}
