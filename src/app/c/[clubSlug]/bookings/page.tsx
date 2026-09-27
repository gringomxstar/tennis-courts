import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getUserBookings, getCourtsByTenantId, getUserWallet } from "@/lib/data";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Trophy,
  ChevronLeft,
  Users,
  CheckCircle2,
  Plus,
  Coins,
  Receipt,
  Zap,
} from "lucide-react";
import { Booking } from "@/types";
import { formatTime24 } from "@/lib/utils";
import { CancelBookingButton } from "@/components/calendar/cancel-booking-button";

interface BookingsPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
}

function splitBookings(bookings: Booking[]) {
  const currentIso = new Date().toISOString();
  const upcoming = bookings
    .filter((b) => b.endsAt > currentIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = bookings
    .filter((b) => b.endsAt <= currentIso)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { upcoming, past };
}

export default async function UserBookingsPage({ params }: BookingsPageProps) {
  const { clubSlug } = await params;
  const context = await getTenantContext(clubSlug);
  const tenant = context.tenant;

  if (!context.user) {
    redirect(`/login?callbackUrl=/c/${clubSlug}/bookings`);
  }

  const [bookings, courts, wallet] = await Promise.all([
    getUserBookings(context.user.id),
    getCourtsByTenantId(tenant.id),
    getUserWallet(tenant.id, context.user.id),
  ]);

  const courtMap = new Map(courts.map((c) => [c.id, c]));
  const { upcoming: upcomingBookings, past: pastBookings } = splitBookings(bookings);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17] tennis-grid-bg">
      <Navbar currentTenant={tenant} user={context.user} wallet={wallet} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header with back navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href={`/c/${tenant.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E25B36] hover:text-[#C84B2B] mb-2 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Zurück zum Buchungskalender
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-[#E25B36]" />
              Meine Reservierungen & Guthaben
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Deine anstehenden Matches, Buchungshistorie und Club-Credits im {tenant.name}.
            </p>
          </div>

          <Link href={`/c/${tenant.slug}`}>
            <Button
              size="sm"
              className="bg-[#E25B36] hover:bg-[#C84B2B] text-white font-semibold text-xs h-9 px-4 rounded-xl gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Neues Match buchen
            </Button>
          </Link>
        </div>

        {/* Quick Stats & Wallet Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#141A26] border border-slate-200/80 dark:border-white/[0.07] shadow-xs backdrop-blur-md">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Anstehende Matches
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
              {upcomingBookings.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#141A26] border border-slate-200/80 dark:border-white/[0.07] shadow-xs backdrop-blur-md">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Club-Guthaben (Credits)
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <Coins className="w-5 h-5 text-amber-500" />
              <span className="text-2xl font-black text-slate-900 dark:text-amber-400">
                {wallet.balance.toFixed(2)} CHF
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#141A26] border border-slate-200/80 dark:border-white/[0.07] shadow-xs backdrop-blur-md">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Club-Status
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Aktivmitglied &bull; Spielberechtigt
            </span>
          </div>
        </div>

        {/* E.1 Credit-Konto Transaktionshistorie (Quittungen) */}
        {wallet.transactions.length > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-[#141A26] border border-slate-200/80 dark:border-white/[0.07] shadow-xs backdrop-blur-md space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#E25B36]" />
              Guthaben-Historie & Quittungen ({wallet.transactions.length})
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
              {wallet.transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {tx.description}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleDateString("de-CH", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })} Uhr
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      tx.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)} CHF
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Bookings Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📅 Anstehende Reservierungen</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#E25B36]/10 text-[#E25B36] border border-[#E25B36]/20">
                {upcomingBookings.length}
              </span>
            </h2>
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-white/80 dark:bg-[#141A26] border border-slate-200/80 dark:border-white/[0.07] shadow-xs backdrop-blur-md space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-[#101522] text-slate-400 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Keine bevorstehenden Reservierungen.
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Sichere dir jetzt deinen Platz für das nächste Match oder Einzeltraining im Club.
              </p>
              <Link href={`/c/${tenant.slug}`}>
                <Button size="sm" className="bg-[#E25B36] hover:bg-[#C84B2B] text-white rounded-xl text-xs font-semibold cursor-pointer">
                  Jetzt Platz wählen
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => {
                const startDate = new Date(booking.startsAt);
                const court = courtMap.get(booking.courtId);
                const courtName = court?.name || "Tennisplatz";

                const otherParticipants = booking.participants.filter((p) => p.role !== "ORGANIZER");
                const partnerNames = otherParticipants.length > 0
                  ? otherParticipants
                      .map((p) => (p.user ? `${p.user.firstName} ${p.user.lastName}` : p.guestName || "Gast"))
                      .join(", ")
                  : "Kein Partner eingetragen";

                return (
                  <div
                    key={booking.id}
                    className="p-5 rounded-3xl bg-white/95 dark:bg-[#141A26] border border-slate-200/90 dark:border-white/[0.08] shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-slate-900 dark:text-white">
                          {courtName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Bestätigt
                        </span>
                        {court?.surface === "CLAY" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E25B36]/10 text-[#E25B36] border border-[#E25B36]/25">
                            Sand (Clay)
                          </span>
                        )}
                        {court?.sportType === "PADEL" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                            Padel
                          </span>
                        )}
                        {booking.hasBallMachine && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" /> Ballmaschine
                          </span>
                        )}
                        {booking.hasLighting && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Flutlicht
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-[#E25B36]" />
                          {startDate.toLocaleDateString("de-CH", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1 font-mono" suppressHydrationWarning>
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatTime24(booking.startsAt)} – {formatTime24(booking.endsAt)} Uhr
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {partnerNames}
                        </span>
                      </div>

                      {booking.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">„{booking.notes}“</p>
                      )}
                    </div>

                    <CancelBookingButton
                      bookingId={booking.id}
                      clubSlug={tenant.slug}
                      courtName={courtName}
                      formattedTime={`${formatTime24(booking.startsAt)} – ${formatTime24(booking.endsAt)} Uhr`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past Bookings Section */}
        {pastBookings.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>🏁 Gespielte Matches ({pastBookings.length})</span>
              </h2>
            </div>

            <div className="space-y-3 opacity-80 hover:opacity-100 transition-opacity">
              {pastBookings.map((booking) => {
                const startDate = new Date(booking.startsAt);
                const court = courtMap.get(booking.courtId);
                const courtName = court?.name || "Tennisplatz";

                const otherParticipants = booking.participants.filter((p) => p.role !== "ORGANIZER");
                const partnerNames = otherParticipants.length > 0
                  ? otherParticipants
                      .map((p) => (p.user ? `${p.user.firstName} ${p.user.lastName}` : p.guestName || "Gast"))
                      .join(", ")
                  : "Einzel";

                return (
                  <div
                    key={booking.id}
                    className="p-4 rounded-2xl bg-white/70 dark:bg-[#101522] border border-slate-200/70 dark:border-white/[0.05] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                          {courtName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
                          Abgeschlossen
                        </span>
                        {booking.hasBallMachine && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
                            Ballmaschine
                          </span>
                        )}
                        {booking.hasLighting && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                            Flutlicht
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {startDate.toLocaleDateString("de-CH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTime24(booking.startsAt)} – {formatTime24(booking.endsAt)} Uhr
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          {partnerNames}
                        </span>
                      </div>
                    </div>

                    {booking.totalCost !== undefined && booking.totalCost > 0 && (
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-lg">
                        {booking.totalCost.toFixed(2)} CHF
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
