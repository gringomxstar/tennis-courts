import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getUserBookings, getCourtsByTenantId } from "@/lib/data";
import { Navbar } from "@/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Trophy, ChevronLeft } from "lucide-react";
import { cancelBookingAction } from "@/app/actions/booking";

interface BookingsPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
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

  const courtMap = new Map(courts.map((c) => [c.id, c.name]));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar currentTenant={tenant} user={context.user} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link
            href={`/c/${tenant.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Zurück zum Buchungskalender
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-emerald-600" />
            Meine Reservierungen ({tenant.name})
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Übersicht aller deiner bevorstehenden und aktiven Tennisplatz-Buchungen.
          </p>
        </div>

        {bookings.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="space-y-3">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Du hast aktuell keine aktiven Reservierungen.
              </p>
              <Link href={`/c/${tenant.slug}`}>
                <Button size="sm">Jetzt Platz buchen</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const startDate = new Date(booking.startsAt);
              const endDate = new Date(booking.endsAt);
              const courtName = courtMap.get(booking.courtId) || "Tennisplatz";

              const opponent = booking.participants.find((p) => p.role !== "ORGANIZER");
              const opponentName = opponent?.user
                ? `${opponent.user.firstName} ${opponent.user.lastName}`
                : opponent?.guestName || "Kein Partner";

              return (
                <Card key={booking.id} className="overflow-hidden">
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-slate-900 dark:text-white">
                          {courtName}
                        </span>
                        <Badge className="bg-emerald-600 text-white text-[10px]">Bestätigt</Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {startDate.toLocaleDateString("de-CH", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" – "}
                          {endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} Uhr
                        </span>
                        <span>• Mitspieler: {opponentName}</span>
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
                      <Button variant="outline" size="sm" type="submit" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                        Stornieren
                      </Button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
