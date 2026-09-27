"use client";

import { useState } from "react";
import { Tenant, Court, Booking, CourtBlock, UserSummary } from "@/types";
import { CourtGrid } from "./court-grid";
import { BookingModal } from "./booking-modal";
import { BookingDetailsModal } from "./booking-details-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Plus,
  MapPin,
  Clock,
} from "lucide-react";

interface CourtCalendarProps {
  tenant: Tenant;
  courts: Court[];
  initialBookings: Booking[];
  initialCourtBlocks: CourtBlock[];
  members: UserSummary[];
  currentUserId?: string;
  isClubAdmin?: boolean;
}

export function CourtCalendar({
  tenant,
  courts,
  initialBookings,
  initialCourtBlocks,
  members,
  currentUserId,
  isClubAdmin,
}: CourtCalendarProps) {
  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

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

  // Date manipulation helpers
  const handleDateChange = (daysDelta: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + daysDelta);
    setSelectedDate(cur.toISOString().split("T")[0]);
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

  // Formatted date string in German
  const formattedDisplayDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
    "de-CH",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  const isToday = selectedDate === todayStr;

  return (
    <div className="space-y-6">
      {/* Club Top Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {tenant.name}
              </h1>
              <Badge className="bg-emerald-600 text-white">Live Belegung</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
              {tenant.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  {tenant.address}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Öffnungszeiten: {tenant.settingsJson?.openingHour || 7}:00 –{" "}
                {tenant.settingsJson?.closingHour || 22}:00 Uhr
              </span>
              <span>• {courts.length} Plätze insgesamt</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => {
                setSelectedCourtId(courts[0]?.id || "");
                setSelectedTime("10:00");
                setBookingModalOpen(true);
              }}
              className="gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Platz reservieren
            </Button>
          </div>
        </div>
      </div>

      {/* Date Navigation & Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDateChange(-1)}
            title="Vorheriger Tag"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant={isToday ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSelectedDate(todayStr)}
            className="font-medium"
          >
            Heute
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDateChange(1)}
            title="Nächster Tag"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="relative flex items-center gap-2 pl-2">
            <span className="text-base font-bold text-slate-900 dark:text-white capitalize">
              {formattedDisplayDate}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="opacity-0 absolute inset-0 cursor-pointer w-full"
              title="Anderes Datum wählen"
            />
            <CalendarIcon className="w-4 h-4 text-emerald-600 pointer-events-none" />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>

          {/* Surface */}
          <button
            onClick={() => setSurfaceFilter(surfaceFilter === "CLAY" ? "ALL" : "CLAY")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              surfaceFilter === "CLAY"
                ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Sand (Clay)
          </button>

          <button
            onClick={() => setSurfaceFilter(surfaceFilter === "HARD" ? "ALL" : "HARD")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              surfaceFilter === "HARD"
                ? "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950 dark:text-blue-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Hartplatz
          </button>

          {/* Indoor / Outdoor */}
          <button
            onClick={() => setIndoorFilter(indoorFilter === "OUTDOOR" ? "ALL" : "OUTDOOR")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              indoorFilter === "OUTDOOR"
                ? "bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Outdoor
          </button>

          <button
            onClick={() => setIndoorFilter(indoorFilter === "INDOOR" ? "ALL" : "INDOOR")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              indoorFilter === "INDOOR"
                ? "bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Halle
          </button>

          {/* Lighting */}
          <button
            onClick={() => setLightingOnly(!lightingOnly)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              lightingOnly
                ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Mit Flutlicht
          </button>
        </div>
      </div>

      {/* Legend & Grid Info */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" />
            Frei
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Meine Buchung
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            Belegt
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            Gesperrt / Wartung
          </span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Klicke auf einen freien Slot, um direkt zu reservieren.
        </span>
      </div>

      {/* Court Grid */}
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

      {/* Modals */}
      <BookingModal
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
