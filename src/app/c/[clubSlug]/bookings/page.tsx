import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getUserBookings, getCourtsByTenantId } from "@/lib/data";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Trophy,
  ChevronLeft,
  Users,
  CheckCircle2,
  Trash2,
  Plus,
} from "lucide-react";
import { cancelBookingAction } from "@/app/actions/booking";
import { Booking } from "@/types";

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

  const [bookings, courts] = await Promise.all([
    getUserBookings(context.user.id),
    getCourtsByTenantId(tenant.id),
  ]);

  const courtMap = new Map(courts.map((c) => [c.id, c]));
  const { upcoming: upcomingBookings, past: pastBookings } = splitBookings(bookings);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 tennis-grid-bg">
      <Navbar currentTenant={tenant} user={context.user} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header with back navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href={`/c/${tenant.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 mb-2 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Zurück zum Buchungskalender
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-emerald-600" />
              Meine Reservierungen
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Deine anstehenden Matches und Reservierungen im {tenant.name}.
            </p>
          </div>

          <Link href={`/c/${tenant.slug}`}>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 rounded-xl gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Neues Match buchen
            </Button>
          </Link>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Anstehende Matches
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
              {upcomingBookings.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Gespielte Matches
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
              {pastBookings.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Club-Status
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Aktivitätsberechtigt
            </span>
          </div>
        </div>

        {/* Upcoming Bookings Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📅 Anstehende Reservierungen</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {upcomingBookings.length}
              </span>
            </h2>
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Keine bevorstehenden Reservierungen.
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Sichere dir jetzt deinen Platz für das nächste Match oder Einzeltraining im Club.
              </p>
              <Link href={`/c/${tenant.slug}`}>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold">
                  Jetzt Platz wählen
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => {
                const startDate = new Date(booking.startsAt);
                const endDate = new Date(booking.endsAt);
                const court = courtMap.get(booking.courtId);
                const courtName = court?.name || "Tennisplatz";

                const opponent = booking.participants.find((p) => p.role !== "ORGANIZER");
                const opponentName = opponent?.user
                  ? `${opponent.user.firstName} ${opponent.user.lastName}`
                  : opponent?.guestName || "Kein Partner eingetragen";

                return (
                  <div
                    key={booking.id}
                    className="p-5 rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-slate-900 dark:text-white">
                          {courtName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Bestätigt
                        </span>
                        {court?.surface === "CLAY" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                            Sand
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {startDate.toLocaleDateString("de-CH", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" – "}
                          {endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} Uhr
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {opponentName}
                        </span>
                      </div>

                      {booking.notes && (
                        <p className="text-xs text-slate-500 italic">„{booking.notes}“</p>
                      )}
                    </div>

                    <form
                      action={async () => {
                        "use server";
                        await cancelBookingAction(booking.id, tenant.slug);
                      }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        type="submit"
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/60 rounded-xl gap-1.5 h-8 font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Stornieren
                      </Button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
