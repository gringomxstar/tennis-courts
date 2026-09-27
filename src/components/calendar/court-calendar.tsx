"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tenant, Court, Booking, CourtBlock, UserSummary } from "@/types";
import { CourtGrid } from "./court-grid";
import { BookingModal } from "./booking-modal";
import { BookingDetailsModal } from "./booking-details-modal";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Plus,
  MapPin,
  Clock,
  Loader2,
} from "lucide-react";

interface CourtCalendarProps {
  tenant: Tenant;
  courts: Court[];
  initialBookings: Booking[];
  initialCourtBlocks: CourtBlock[];
  members: UserSummary[];
  currentUserId?: string;
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
    <div className="space-y-6">
      {/* Club Top Banner with Sports-Tech Gradient */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 shadow-sm p-6 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 rounded-full bg-amber-500/10 dark:bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {tenant.name}
              </h1>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Belegung
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              {tenant.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  {tenant.address}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Öffnungszeiten: {tenant.settingsJson?.openingHour || 7}:00 –{" "}
                {tenant.settingsJson?.closingHour || 22}:00 Uhr
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                🎾 {courts.length} Plätze bespielbar
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-10 px-4 rounded-xl shadow-md shadow-emerald-600/20 gap-2 transition-all hover:scale-102"
            >
              <Plus className="w-4 h-4" />
              Platz reservieren
            </Button>
          </div>
        </div>
      </div>

      {/* Date Carousel & Filter Bar */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 shadow-sm p-4 backdrop-blur-xl space-y-4">
        {/* Top: 7-Day Carousel Strip */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDateChange(-1)}
            className="shrink-0 h-11 w-11 rounded-2xl border-slate-200 dark:border-slate-800"
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
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 scale-105 font-bold"
                    : "bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-800/70 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider ${day.isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                  {day.weekday}
                </span>
                <span className="text-base font-extrabold leading-tight mt-0.5">
                  {day.dayNum}
                </span>
                {day.isToday && (
                  <span className={`text-[9px] font-bold mt-0.5 ${day.isSelected ? "text-white" : "text-emerald-600"}`}>
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
            className="shrink-0 h-11 w-11 rounded-2xl border-slate-200 dark:border-slate-800"
            title="Nächster Tag"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Bottom: Date title & Quick Filters */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
              {formattedDisplayDate}
            </span>
            {isPending && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && navigateToDate(e.target.value)}
              className="opacity-0 absolute inset-0 cursor-pointer w-full"
              title="Anderes Datum wählen"
            />
            <span className="text-[11px] text-slate-400 hover:text-emerald-600 underline cursor-pointer">
              (Datum wählen)
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>

            <button
              onClick={() => setSurfaceFilter(surfaceFilter === "CLAY" ? "ALL" : "CLAY")}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                surfaceFilter === "CLAY"
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              Sandplatz
            </button>

            <button
              onClick={() => setSurfaceFilter(surfaceFilter === "HARD" ? "ALL" : "HARD")}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                surfaceFilter === "HARD"
                  ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              Hartplatz
            </button>

            <button
              onClick={() => setIndoorFilter(indoorFilter === "OUTDOOR" ? "ALL" : "OUTDOOR")}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                indoorFilter === "OUTDOOR"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              Freiplatz (Outdoor)
            </button>

            <button
              onClick={() => setIndoorFilter(indoorFilter === "INDOOR" ? "ALL" : "INDOOR")}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                indoorFilter === "INDOOR"
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              Halle (Indoor)
            </button>

            <button
              onClick={() => setLightingOnly(!lightingOnly)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                lightingOnly
                  ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              Mit Flutlicht
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Component */}
      <div className={isPending ? "opacity-50 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
        <CourtGrid
          courts={filteredCourts}
          bookings={initialBookings}
          courtBlocks={initialCourtBlocks}
          dateStr={selectedDate}
          openingHour={tenant.settingsJson?.openingHour || 7}
          closingHour={tenant.settingsJson?.closingHour || 22}
          currentUserId={currentUserId}
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
          clubSlug={tenant.slug}
          courts={courts}
          members={members}
          currentUserId={currentUserId}
          selectedCourtId={selectedCourtId}
          selectedDateStr={selectedDate}
          selectedTimeStr={selectedTime}
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
