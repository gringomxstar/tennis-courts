"use client";

import { useState } from "react";
import { Court, Booking, CourtBlock } from "@/types";
import { Clock, Plus, Wrench } from "lucide-react";
import { formatTime24 } from "@/lib/utils";

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
  const [selectedMobileCourtId, setSelectedMobileCourtId] = useState<string>(
    courts[0]?.id || ""
  );

  const hours: number[] = [];
  for (let h = openingHour; h < closingHour; h++) {
    hours.push(h);
  }

  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  const isPastSlot = (hour: number) => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    const currentHour = new Date().getHours();
    return hour < currentHour;
  };

  const getBookingForSlot = (courtId: string, hour: number) => {
    const slotStartMs = new Date(`${dateStr}T${formatHour(hour)}:00`).getTime();
    const slotEndMs = slotStartMs + 60 * 60 * 1000;

    return bookings.find((b) => {
      if (b.courtId !== courtId || b.status === "CANCELLED") return false;
      const bStart = new Date(b.startsAt).getTime();
      const bEnd = new Date(b.endsAt).getTime();
      return slotStartMs < bEnd && slotEndMs > bStart;
    });
  };

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

  const getSurfaceBadge = (surface: string) => {
    switch (surface) {
      case "CLAY":
        return {
          label: "Sand (Clay)",
          color: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
          barColor: "bg-amber-600",
        };
      case "HARD":
        return {
          label: "Hartplatz",
          color: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
          barColor: "bg-blue-600",
        };
      case "ARTIFICIAL_GRASS":
        return {
          label: "Kunstrasen",
          color: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
          barColor: "bg-emerald-600",
        };
      case "CARPET":
        return {
          label: "Teppich / Granulat",
          color: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
          barColor: "bg-purple-600",
        };
      default:
        return {
          label: surface,
          color: "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
          barColor: "bg-slate-600",
        };
    }
  };

  const renderSlotCell = (court: Court, hour: number) => {
    const booking = getBookingForSlot(court.id, hour);
    const block = getCourtBlockForSlot(court.id, hour);
    const past = isPastSlot(hour);
    const timeStr = formatHour(hour);

    // 1. Court Block (Platzsperre)
    if (block) {
      return (
        <div
          key={`${court.id}-${hour}`}
          className="relative h-24 p-3 rounded-2xl border border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/60 flex flex-col justify-between overflow-hidden shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              {block.reason === "MAINTENANCE"
                ? "Platzpflege"
                : block.reason === "TOURNAMENT"
                ? "Clubturnier"
                : block.reason === "RAIN"
                ? "Witterung"
                : "Gesperrt"}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
              Sperre
            </span>
          </div>
          {block.description ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-300 truncate mt-1">
              {block.description}
            </p>
          ) : (
            <span className="text-[10px] text-amber-600/80">Nicht bespielbar</span>
          )}
          <span className="text-[10px] text-amber-700/70 font-mono">
            {timeStr} – {formatHour(hour + 1)}
          </span>
        </div>
      );
    }

    // 2. Gebuchter Slot
    if (booking) {
      const isMyBooking =
        currentUserId &&
        (booking.organizerId === currentUserId ||
          booking.participants.some((p) => p.userId === currentUserId));

      const opponent = booking.participants.find((p) => p.role !== "ORGANIZER");
      const opponentName = opponent?.user
        ? `${opponent.user.firstName} ${opponent.user.lastName}`
        : opponent?.guestName;

      const organizerInitials = booking.organizer
        ? `${booking.organizer.firstName?.[0] || ""}${booking.organizer.lastName?.[0] || ""}`.toUpperCase()
        : "TC";

      return (
        <div
          key={`${court.id}-${hour}`}
          onClick={() => onSelectBooking(booking)}
          className={`group relative h-24 p-3 rounded-2xl cursor-pointer transition-all border shadow-xs flex flex-col justify-between overflow-hidden hover:scale-[1.01] hover:shadow-md ${
            isMyBooking
              ? "bg-gradient-to-br from-emerald-50/95 to-teal-50/70 border-emerald-500 text-emerald-950 dark:from-emerald-950/60 dark:to-teal-950/40 dark:border-emerald-500 dark:text-emerald-100 ring-2 ring-emerald-500/25"
              : "bg-gradient-to-br from-slate-100/90 to-slate-50 border-slate-300/80 text-slate-900 hover:bg-slate-200/80 dark:from-slate-800/80 dark:to-slate-900/60 dark:border-slate-700 dark:text-slate-100"
          }`}
        >
          {/* Top Line: Player Avatar + Status */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 truncate">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                  isMyBooking
                    ? "bg-emerald-600 shadow-xs"
                    : "bg-slate-600"
                }`}
              >
                {organizerInitials}
              </div>
              <span className="font-bold text-xs truncate">
                {booking.organizer?.firstName} {booking.organizer?.lastName}
              </span>
            </div>

            {isMyBooking ? (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-600 text-white shadow-xs">
                Mein Match
              </span>
            ) : (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                Belegt
              </span>
            )}
          </div>

          {/* Middle: Opponent / Guest */}
          <div className="flex items-center justify-between text-[11px] opacity-80 gap-1 truncate">
            {opponentName ? (
              <span className="truncate">vs. {opponentName}</span>
            ) : (
              <span className="italic text-[10px] opacity-70">Einzel-Reservierung</span>
            )}
            {booking.hasBallMachine && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-200/80 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-200 shrink-0">
                🎾 Ballmaschine
              </span>
            )}
          </div>

          {/* Bottom Line: Time & notes */}
          <div className="flex items-center justify-between text-[10px] opacity-70 font-mono">
            <span className="flex items-center gap-1" suppressHydrationWarning>
              <Clock className="w-3 h-3 text-slate-400" />
              {formatTime24(booking.startsAt)} - {formatTime24(booking.endsAt)}
            </span>
            {booking.notes && (
              <span className="truncate italic font-sans max-w-[90px]">„{booking.notes}“</span>
            )}
          </div>
        </div>
      );
    }

    // 3. Freier Slot (Available)
    return (
      <div
        key={`${court.id}-${hour}`}
        onClick={() => !past && onSelectSlot(court.id, timeStr)}
        className={`group relative h-24 rounded-2xl border transition-all flex flex-col items-center justify-center p-2.5 ${
          past
            ? "border-slate-200/60 bg-slate-100/40 text-slate-400 dark:border-slate-800/50 dark:bg-slate-900/30 cursor-not-allowed"
            : "border-dashed border-slate-300/80 bg-white/70 hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-md hover:scale-[1.01] cursor-pointer dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/25"
        }`}
      >
        {past ? (
          <div className="flex flex-col items-center justify-center text-slate-400 text-center">
            <Clock className="w-3.5 h-3.5 mb-1 opacity-50" />
            <span className="text-[10px] font-medium font-mono">{timeStr}</span>
            <span className="text-[9px] opacity-60">Abgelaufen</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-600 group-hover:text-white text-slate-500 flex items-center justify-center transition-all mb-1 group-hover:scale-110 shadow-xs">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 font-mono">
              {timeStr}
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-emerald-600 font-medium">
              Frei buchen
            </span>
          </div>
        )}
      </div>
    );
  };

  if (courts.length === 0) {
    return (
      <div className="py-20 text-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-8 shadow-sm">
        <span className="text-3xl mb-2 block">🎾</span>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Keine Plätze für diese Filter gefunden
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Bitte passe deine Auswahl nach Belag oder Hallenplatz an.
        </p>
      </div>
    );
  }

  const activeCourt =
    courts.find((c) => c.id === selectedMobileCourtId) || courts[0];
  const activeCourtSurface = activeCourt ? getSurfaceBadge(activeCourt.surface) : null;

  return (
    <div className="w-full space-y-4">
      {/* ========================================================= */}
      {/* 1. MOBILE VIEW (lg:hidden): Dedicated Single Court Feed   */}
      {/* ========================================================= */}
      <div className="lg:hidden space-y-4">
        {/* Court selection tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {courts.map((court) => {
            const isSelected = activeCourt?.id === court.id;
            return (
              <button
                key={court.id}
                onClick={() => setSelectedMobileCourtId(court.id)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-emerald-600/20 scale-102"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
                }`}
              >
                {court.name}
              </button>
            );
          })}
        </div>

        {/* Selected Court Hero Card */}
        {activeCourt && activeCourtSurface && (
          <div className="relative overflow-hidden p-4 rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800/90 shadow-xs backdrop-blur-xl">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${activeCourtSurface.barColor}`} />
            <div className="flex items-center justify-between gap-2 mt-1">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {activeCourt.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>{activeCourt.isIndoor ? "🏢 Hallenplatz" : "☀️ Freiplatz"}</span>
                  {activeCourt.hasLighting && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      • 💡 Flutlicht
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${activeCourtSurface.color}`}>
                {activeCourtSurface.label}
              </span>
            </div>
          </div>
        )}

        {/* Vertical Feed of Time Slots for Active Court */}
        <div className="space-y-2.5">
          {activeCourt &&
            hours.map((hour) => {
              const booking = getBookingForSlot(activeCourt.id, hour);
              const block = getCourtBlockForSlot(activeCourt.id, hour);
              const past = isPastSlot(hour);
              const timeStr = formatHour(hour);
              const nextHourStr = formatHour(hour + 1);

              if (block) {
                return (
                  <div
                    key={`mobile-${activeCourt.id}-${hour}`}
                    className="p-3.5 rounded-2xl border border-amber-300/80 bg-amber-50/90 dark:bg-amber-950/40 dark:border-amber-900/60 flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center font-mono w-14 py-1 rounded-xl bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                        <span className="text-xs font-bold">{timeStr}</span>
                        <span className="text-[10px] opacity-75">{nextHourStr}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 dark:text-amber-200">
                          <Wrench className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {block.reason === "MAINTENANCE"
                              ? "Platzpflege"
                              : block.reason === "TOURNAMENT"
                              ? "Clubturnier"
                              : block.reason === "RAIN"
                              ? "Witterung"
                              : "Gesperrt"}
                          </span>
                        </div>
                        {block.description && (
                          <p className="text-[11px] text-amber-800/80 dark:text-amber-300 mt-0.5">
                            {block.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                      Sperre
                    </span>
                  </div>
                );
              }

              if (booking) {
                const isMyBooking =
                  currentUserId &&
                  (booking.organizerId === currentUserId ||
                    booking.participants.some((p) => p.userId === currentUserId));

                const opponent = booking.participants.find((p) => p.role !== "ORGANIZER");
                const opponentName = opponent?.user
                  ? `${opponent.user.firstName} ${opponent.user.lastName}`
                  : opponent?.guestName;

                const organizerInitials = booking.organizer
                  ? `${booking.organizer.firstName?.[0] || ""}${booking.organizer.lastName?.[0] || ""}`.toUpperCase()
                  : "TC";

                return (
                  <div
                    key={`mobile-${activeCourt.id}-${hour}`}
                    onClick={() => onSelectBooking(booking)}
                    className={`p-3.5 rounded-2xl cursor-pointer transition-all border shadow-xs flex items-center justify-between active:scale-[0.98] ${
                      isMyBooking
                        ? "bg-gradient-to-r from-emerald-50/95 to-teal-50/80 border-emerald-500 text-emerald-950 dark:from-emerald-950/60 dark:to-teal-950/40 dark:border-emerald-500 dark:text-emerald-100 ring-2 ring-emerald-500/25"
                        : "bg-slate-100/90 border-slate-300/80 text-slate-900 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="flex flex-col items-center justify-center font-mono w-14 py-1 rounded-xl bg-black/5 dark:bg-white/10 shrink-0">
                        <span className="text-xs font-bold">{timeStr}</span>
                        <span className="text-[10px] opacity-70">{nextHourStr}</span>
                      </div>
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                            isMyBooking ? "bg-emerald-600 shadow-xs" : "bg-slate-600"
                          }`}
                        >
                          {organizerInitials}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-xs block truncate">
                            {booking.organizer?.firstName} {booking.organizer?.lastName}
                          </span>
                          <span className="text-[11px] opacity-75 truncate block">
                            {opponentName ? `vs. ${opponentName}` : "Einzel-Reservierung"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isMyBooking ? (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                          Mein Match
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          Belegt
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // Available Slot
              return (
                <div
                  key={`mobile-${activeCourt.id}-${hour}`}
                  onClick={() => !past && onSelectSlot(activeCourt.id, timeStr)}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    past
                      ? "border-slate-200/60 bg-slate-100/40 text-slate-400 dark:border-slate-800/50 dark:bg-slate-900/30 cursor-not-allowed"
                      : "border-dashed border-emerald-400/80 bg-white/90 hover:border-emerald-500 hover:bg-emerald-50/50 active:scale-[0.98] cursor-pointer dark:border-emerald-800/60 dark:bg-slate-900/80 dark:hover:bg-emerald-950/30 shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex flex-col items-center justify-center font-mono w-14 py-1 rounded-xl ${
                        past
                          ? "bg-slate-200/50 text-slate-400 dark:bg-slate-800"
                          : "bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                      }`}
                    >
                      <span className="text-xs">{timeStr}</span>
                      <span className="text-[10px] opacity-75">{nextHourStr}</span>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold block ${
                          past ? "text-slate-400" : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {past ? "Zeitfenster abgelaufen" : "Freier Platz"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {past ? "Keine Buchung möglich" : "Tippen zum Reservieren"}
                      </span>
                    </div>
                  </div>

                  {!past && (
                    <button
                      type="button"
                      className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs shadow-emerald-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Buchen
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. DESKTOP VIEW (hidden lg:block): Multi-Court Overview   */}
      {/* ========================================================= */}
      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/95 backdrop-blur-xl">
        <div
          className="min-w-full"
          style={{
            display: "grid",
            gridTemplateColumns: `85px repeat(${courts.length}, minmax(190px, 1fr))`,
          }}
        >
          {/* Header Row: Time spacer + Court Headers */}
          <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md p-4 border-b border-r border-slate-200 dark:bg-slate-800/95 dark:border-slate-700 flex flex-col items-center justify-center">
            <span className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">
              Uhrzeit
            </span>
          </div>

          {courts.map((court) => {
            const surfaceMeta = getSurfaceBadge(court.surface);
            return (
              <div
                key={court.id}
                className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md p-4 border-b border-r border-slate-200 dark:bg-slate-800/95 dark:border-slate-700 last:border-r-0 relative overflow-hidden"
              >
                {/* Surface Accent Line */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${surfaceMeta.barColor}`} />

                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {court.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {court.sportType === "PADEL" ? "Padel" : "Tennis"}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${surfaceMeta.color}`}>
                    {surfaceMeta.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    {court.isIndoor ? "🏢 Halle" : "☀️ Freiplatz"}
                    {court.hasLighting && (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        • 💡
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold text-[10px]">
                    {court.hourlyRate} CHF/h
                  </span>
                </div>
              </div>
            );
          })}

          {/* Time Rows */}
          {hours.map((hour) => (
            <div key={`row-${hour}`} className="contents">
              {/* Sticky Time Column */}
              <div className="p-3 border-b border-r border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatHour(hour)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {formatHour(hour + 1)}
                </span>
              </div>

              {/* Court Slots for this Hour */}
              {courts.map((court) => (
                <div
                  key={`slot-${court.id}-${hour}`}
                  className="p-2 border-b border-r border-slate-100 dark:border-slate-800/80 last:border-r-0"
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
