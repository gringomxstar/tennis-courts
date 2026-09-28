"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tenant, Court, Booking, CourtBlock, UserSummary, SportType } from "@/types";
import { CourtGrid } from "./court-grid";
import { BookingModal } from "./booking-modal";
import { BookingDetailsModal } from "./booking-details-modal";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  MapPin,
  Clock,
  Loader2,
  Trophy,
  Lightbulb,
} from "lucide-react";

interface CourtCalendarProps {
  tenant: Tenant;
  courts: Court[];
  initialBookings: Booking[];
  initialCourtBlocks: CourtBlock[];
  members: UserSummary[];
  currentUserId?: string;
  userWallet?: { balance: number; currency: string } | null;
  isClubAdmin?: boolean;
  selectedDate: string;
}

export function CourtCalendar({
  tenant,
  courts,
  initialBookings,
  initialCourtBlocks,
  members,
  currentUserId,
  userWallet,
  isClubAdmin,
  selectedDate,
}: CourtCalendarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];

  // Filters
  const [sportFilter, setSportFilter] = useState<string>("ALL");
  const [surfaceFilter, setSurfaceFilter] = useState<string>("ALL");
  const [indoorFilter, setIndoorFilter] = useState<string>("ALL");
  const [lightingOnly, setLightingOnly] = useState<boolean>(false);

  // Modal States
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string>(courts[0]?.id || "");
  const [selectedTime, setSelectedTime] = useState<string>("10:00");

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const navigateToDate = (newDateStr: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.set("date", newDateStr);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Helper to generate 7-day carousel around selected date
  const generate7DayStrip = () => {
    const base = new Date(`${selectedDate}T12:00:00`);
    const days: { dateStr: string; dayNum: number; weekday: string; isToday: boolean; isSelected: boolean }[] = [];

    // Show 3 days before and 3 days after, or 7 days starting today
    for (let i = -2; i <= 4; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const str = d.toISOString().split("T")[0];
      const weekday = d.toLocaleDateString("de-CH", { weekday: "short" });
      days.push({
        dateStr: str,
        dayNum: d.getDate(),
        weekday: weekday.replace(".", ""),
        isToday: str === todayStr,
        isSelected: str === selectedDate,
      });
    }
    return days;
  };

  const dayStrip = generate7DayStrip();

  // Date manipulation helpers
  const handleDateChange = (daysDelta: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + daysDelta);
    navigateToDate(cur.toISOString().split("T")[0]);
  };

  const handleSelectSlot = (courtId: string, timeStr: string) => {
    setSelectedCourtId(courtId);
    setSelectedTime(timeStr);
    setBookingModalOpen(true);
  };

  const handleSelectBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailsModalOpen(true);
  };

  // Filter courts
  const filteredCourts = courts.filter((court) => {
    if (sportFilter !== "ALL" && court.sportType !== (sportFilter as SportType)) return false;
    if (surfaceFilter !== "ALL" && court.surface !== surfaceFilter) return false;
    if (indoorFilter === "INDOOR" && !court.isIndoor) return false;
    if (indoorFilter === "OUTDOOR" && court.isIndoor) return false;
    if (lightingOnly && !court.hasLighting) return false;
    return true;
  });

  const formattedDisplayDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
    "de-CH",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col space-y-4 p-4 md:p-6 lg:p-8">
      {/* Club Top Banner: Roland Garros Nocturne Night Stadium */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm p-6 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-72 h-72 rounded-full bg-clay/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {tenant.name}
              </h1>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300 border border-amber-500/20 dark:border-amber-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Live Belegung
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {tenant.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-clay" />
                  {tenant.address}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {tenant.settingsJson?.openingHour || 7}:00 – {tenant.settingsJson?.closingHour || 22}:00 Uhr
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
                <Trophy className="w-3.5 h-3.5" /> {courts.length} Plätze bespielbar
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setSelectedCourtId(courts[0]?.id || "");
                setSelectedTime("10:00");
                setBookingModalOpen(true);
              }}
              className="bg-clay hover:bg-clay-hover text-white font-semibold text-xs h-10 px-4 rounded-xl shadow-md shadow-clay/25 gap-2 transition-all hover:scale-102 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Platz reservieren
            </Button>
          </div>
        </div>
      </div>

      {/* Date Carousel & Filter Bar */}
      <div className="rounded-3xl border border-border bg-card shadow-sm p-4 backdrop-blur-xl space-y-4">
        {/* Top: 7-Day Carousel Strip */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDateChange(-1)}
            className="shrink-0 h-11 w-11 rounded-2xl border-border dark:bg-secondary text-muted-foreground hover:text-clay cursor-pointer"
            title="Vorheriger Tag"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 flex-1 justify-center min-w-max">
            {dayStrip.map((day) => (
              <button
                key={day.dateStr}
                onClick={() => navigateToDate(day.dateStr)}
                className={`flex flex-col items-center justify-center py-2 px-3.5 min-w-[62px] rounded-2xl transition-all cursor-pointer ${
                  day.isSelected
                    ? "bg-clay text-white shadow-md shadow-clay/30 scale-105 font-bold"
                    : "bg-secondary hover:bg-accent text-muted-foreground border border-border"
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider ${day.isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                  {day.weekday}
                </span>
                <span className="text-base font-extrabold leading-tight mt-0.5">
                  {day.dayNum}
                </span>
                {day.isToday && (
                  <span className={`text-[9px] font-bold mt-0.5 ${day.isSelected ? "text-white" : "text-amber-500 dark:text-amber-400"}`}>
                    Heute
                  </span>
                )}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDateChange(1)}
            className="shrink-0 h-11 w-11 rounded-2xl border-border dark:bg-secondary text-muted-foreground hover:text-clay cursor-pointer"
            title="Nächster Tag"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Bottom: Date title & Segmented Filters */}
        <div className="pt-3 border-t border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-clay" />
            <span className="text-sm font-bold text-foreground capitalize">
              {formattedDisplayDate}
            </span>
            {isPending && <Loader2 className="w-4 h-4 animate-spin text-clay" />}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && navigateToDate(e.target.value)}
              className="opacity-0 absolute inset-0 cursor-pointer w-full"
              title="Anderes Datum wählen"
            />
            <span className="text-[11px] text-muted-foreground hover:text-clay underline cursor-pointer">
              (Kalender)
            </span>
          </div>

          {/* Clean Segmented Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Sport & Surface Pills */}
            <div className="flex items-center p-1 rounded-2xl bg-muted border border-border">
              <button
                onClick={() => {
                  setSportFilter("ALL");
                  setSurfaceFilter("ALL");
                  setIndoorFilter("ALL");
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  sportFilter === "ALL" && surfaceFilter === "ALL" && indoorFilter === "ALL"
                    ? "bg-card dark:bg-accent text-clay dark:text-clay-hover shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Alle Plätze
              </button>

              <button
                onClick={() => {
                  setSurfaceFilter(surfaceFilter === "CLAY" ? "ALL" : "CLAY");
                  setSportFilter("ALL");
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  surfaceFilter === "CLAY"
                    ? "bg-card dark:bg-accent text-clay dark:text-clay-hover shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sand (Clay)
              </button>

              <button
                onClick={() => {
                  setSportFilter(sportFilter === "PADEL" ? "ALL" : "PADEL");
                  setSurfaceFilter("ALL");
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  sportFilter === "PADEL"
                    ? "bg-card dark:bg-accent text-cyan-600 dark:text-cyan-400 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Padel
              </button>

              <button
                onClick={() => {
                  setIndoorFilter(indoorFilter === "INDOOR" ? "ALL" : "INDOOR");
                  setSportFilter("ALL");
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  indoorFilter === "INDOOR"
                    ? "bg-card dark:bg-accent text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Halle
              </button>
            </div>

            {/* Optional Lighting Toggle */}
            <button
              onClick={() => setLightingOnly(!lightingOnly)}
              className={`px-3 py-1.5 rounded-2xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                lightingOnly
                  ? "bg-floodlight/20 text-floodlight border-floodlight/40 shadow-xs"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Flutlicht</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Component */}
      <div className={isPending ? "flex-1 min-h-0 opacity-50 pointer-events-none transition-opacity duration-200" : "flex-1 min-h-0 transition-opacity duration-200"}>
        <CourtGrid
          courts={filteredCourts}
          bookings={initialBookings}
          courtBlocks={initialCourtBlocks}
          dateStr={selectedDate}
          openingHour={tenant.settingsJson?.openingHour || 7}
          closingHour={tenant.settingsJson?.closingHour || 22}
          currentUserId={currentUserId}
          activeCategory="ALL"
          onSelectSlot={handleSelectSlot}
          onSelectBooking={handleSelectBooking}
        />
      </div>

      {/* Modals */}
      {bookingModalOpen && (
        <BookingModal
          key={`booking-modal-${selectedCourtId}-${selectedDate}-${selectedTime}`}
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          tenant={tenant}
          courts={courts}
          members={members}
          currentUserId={currentUserId}
          userWallet={userWallet}
          selectedCourtId={selectedCourtId}
          selectedDateStr={selectedDate}
          selectedTimeStr={selectedTime}
          existingBookings={initialBookings}
        />
      )}

      <BookingDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        booking={selectedBooking}
        clubSlug={tenant.slug}
        currentUserId={currentUserId}
        isClubAdmin={isClubAdmin}
      />
    </div>
  );
}
