"use client";

import { useState } from "react";
import { Court, Booking, CourtBlock } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Wrench } from "lucide-react";

interface CourtGridProps {
  courts: Court[];
  bookings: Booking[];
  courtBlocks: CourtBlock[];
  dateStr: string; // YYYY-MM-DD
  openingHour?: number;
  closingHour?: number;
  currentUserId?: string;
  onSelectSlot: (courtId: string, timeStr: string) => void;
  onSelectBooking: (booking: Booking) => void;
}

export function CourtGrid({
  courts,
  bookings,
  courtBlocks,
  dateStr,
  openingHour = 7,
  closingHour = 22,
  currentUserId,
  onSelectSlot,
  onSelectBooking,
}: CourtGridProps) {
  // Mobile active court tab selector (defaults to first court)
  const [selectedMobileCourtId, setSelectedMobileCourtId] = useState<string>(
    courts[0]?.id || ""
  );

  // Generate hour slots
  const hours: number[] = [];
  for (let h = openingHour; h < closingHour; h++) {
    hours.push(h);
  }

  // Helper to format hour string: e.g. 7 -> "07:00"
  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  // Helper to check if a slot is in the past
  const isPastSlot = (hour: number) => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    const currentHour = new Date().getHours();
    return hour < currentHour;
  };

  // Helper to find booking occupying this court & hour
  const getBookingForSlot = (courtId: string, hour: number) => {
    const slotStartMs = new Date(`${dateStr}T${formatHour(hour)}:00`).getTime();
    const slotEndMs = slotStartMs + 60 * 60 * 1000;

    return bookings.find((b) => {
      if (b.courtId !== courtId || b.status === "CANCELLED") return false;
      const bStart = new Date(b.startsAt).getTime();
      const bEnd = new Date(b.endsAt).getTime();
      // Overlaps if slotStart < bEnd and slotEnd > bStart
      return slotStartMs < bEnd && slotEndMs > bStart;
    });
  };

  // Helper to find court block for this court & hour
  const getCourtBlockForSlot = (courtId: string, hour: number) => {
    const slotStartMs = new Date(`${dateStr}T${formatHour(hour)}:00`).getTime();
    const slotEndMs = slotStartMs + 60 * 60 * 1000;

    return courtBlocks.find((cb) => {
      if (cb.courtId !== courtId) return false;
      const cbStart = new Date(cb.startsAt).getTime();
      const cbEnd = new Date(cb.endsAt).getTime();
      return slotStartMs < cbEnd && slotEndMs > cbStart;
    });
  };

  const getSurfaceLabel = (surface: string) => {
    switch (surface) {
      case "CLAY":
        return "Sand";
      case "HARD":
        return "Hartplatz";
      case "ARTIFICIAL_GRASS":
        return "Kunstrasen";
      case "CARPET":
        return "Teppich";
      default:
        return surface;
    }
  };

  const renderSlotCell = (court: Court, hour: number) => {
    const booking = getBookingForSlot(court.id, hour);
    const block = getCourtBlockForSlot(court.id, hour);
    const past = isPastSlot(hour);
    const timeStr = formatHour(hour);

    // 1. Gesperrter Slot (Court Block)
    if (block) {
      return (
        <div
          key={`${court.id}-${hour}`}
          className="relative h-20 p-2.5 rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-800 flex flex-col justify-between overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              {block.reason === "MAINTENANCE"
                ? "Platzpflege"
                : block.reason === "TOURNAMENT"
                ? "Turnier"
                : block.reason === "RAIN"
                ? "Witterungsbedingt"
                : "Gesperrt"}
            </span>
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800">
              Gesperrt
            </Badge>
          </div>
          {block.description && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 truncate mt-1">
              {block.description}
            </p>
          )}
        </div>
      );
    }

    // 2. Gebuchter Slot (Booking)
    if (booking) {
      const isMyBooking =
        currentUserId &&
        (booking.organizerId === currentUserId ||
          booking.participants.some((p) => p.userId === currentUserId));

      const opponent = booking.participants.find((p) => p.role !== "ORGANIZER");
      const opponentName = opponent?.user
        ? `${opponent.user.firstName} ${opponent.user.lastName}`
        : opponent?.guestName;

      return (
        <div
          key={`${court.id}-${hour}`}
          onClick={() => onSelectBooking(booking)}
          className={`group relative h-20 p-2.5 rounded-xl cursor-pointer transition-all border shadow-xs flex flex-col justify-between overflow-hidden ${
            isMyBooking
              ? "bg-emerald-50/90 border-emerald-500 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:border-emerald-500 dark:text-emerald-100 ring-2 ring-emerald-500/20"
              : "bg-slate-100/90 border-slate-300 text-slate-800 hover:bg-slate-200 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-xs truncate">
                {booking.organizer?.firstName} {booking.organizer?.lastName}
              </span>
              {opponentName && (
                <span className="text-[11px] opacity-75 truncate">
                  + {opponentName.split(" ")[0]}
                </span>
              )}
            </div>

            {isMyBooking ? (
              <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                Meine Buchung
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                Belegt
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] opacity-75 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(booking.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {new Date(booking.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {booking.notes && <span className="truncate italic max-w-[120px]">„{booking.notes}“</span>}
          </div>
        </div>
      );
    }

    // 3. Freier Slot (Available)
    return (
      <div
        key={`${court.id}-${hour}`}
        onClick={() => onSelectSlot(court.id, timeStr)}
        className={`group relative h-20 rounded-xl border border-dashed transition-all flex flex-col items-center justify-center cursor-pointer p-2 ${
          past
            ? "border-slate-200 bg-slate-50/50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40"
            : "border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/40 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/20"
        }`}
      >
        <div className="flex items-center gap-1 text-slate-400 group-hover:text-emerald-600 transition-colors">
          <Plus className="w-4 h-4 transition-transform group-hover:scale-125" />
          <span className="text-xs font-semibold">Frei</span>
        </div>
        <span className="text-[10px] text-slate-400 mt-1 group-hover:text-emerald-700 font-medium">
          {timeStr} reservieren
        </span>
      </div>
    );
  };

  if (courts.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">
        Keine Tennisplätze für die ausgewählten Filter gefunden.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile Court Selector Tabs */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {courts.map((court) => (
          <button
            key={court.id}
            onClick={() => setSelectedMobileCourtId(court.id)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              (selectedMobileCourtId || courts[0]?.id) === court.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {court.name}
          </button>
        ))}
      </div>

      {/* Main Grid: Desktop Multi-Court / Mobile Single-Court or Horizontally Scrollable */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div
          className="min-w-[700px] lg:min-w-full"
          style={{
            display: "grid",
            gridTemplateColumns: `80px repeat(${courts.length}, minmax(180px, 1fr))`,
          }}
        >
          {/* Header Row: Time spacer + Court Headers */}
          <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-xs p-3.5 border-b border-r border-slate-200 dark:bg-slate-800/90 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-500">
            Zeit
          </div>

          {courts.map((court) => (
            <div
              key={court.id}
              className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-xs p-3.5 border-b border-r border-slate-200 dark:bg-slate-800/90 dark:border-slate-700 last:border-r-0"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {court.name}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {getSurfaceLabel(court.surface)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                <span>{court.isIndoor ? "Halle" : "Outdoor"}</span>
                {court.hasLighting && (
                  <span className="flex items-center gap-0.5 text-amber-600">
                    • Flutlicht
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Time Rows */}
          {hours.map((hour) => (
            <div key={`row-${hour}`} className="contents">
              {/* Sticky Time Column */}
              <div className="p-3 border-b border-r border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {formatHour(hour)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {formatHour(hour + 1)}
                </span>
              </div>

              {/* Court Slots for this Hour */}
              {courts.map((court) => (
                <div
                  key={`slot-${court.id}-${hour}`}
                  className="p-1.5 border-b border-r border-slate-100 dark:border-slate-800 last:border-r-0"
                >
                  {renderSlotCell(court, hour)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
