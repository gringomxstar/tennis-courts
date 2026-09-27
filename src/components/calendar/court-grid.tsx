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
          color: "text-[#E25B36] dark:text-[#F37957] bg-[#E25B36]/10 border-[#E25B36]/25",
          barColor: "bg-[#E25B36] shadow-[0_0_8px_rgba(226,91,54,0.4)]",
        };
      case "HARD":
        return {
          label: "Hartplatz",
          color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/25",
          barColor: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.35)]",
        };
      case "ARTIFICIAL_GRASS":
        return {
          label: "Kunstrasen",
          color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
          barColor: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]",
        };
      case "CARPET":
        return {
          label: "Teppich / Halle",
          color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/25",
          barColor: "bg-indigo-500 shadow-[0_0_8px_rgba(129,140,248,0.4)]",
        };
      default:
        return {
          label: surface,
          color: "text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20",
          barColor: "bg-slate-500",
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
          className="relative h-24 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.07] dark:border-amber-500/25 flex flex-col justify-between overflow-hidden shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-500" />
              {block.reason === "MAINTENANCE"
                ? "Platzpflege"
                : block.reason === "TOURNAMENT"
                ? "Clubturnier"
                : block.reason === "RAIN"
                ? "Witterung"
                : "Gesperrt"}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
              Sperre
            </span>
          </div>
          {block.description ? (
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 truncate mt-1">
              {block.description}
            </p>
          ) : (
            <span className="text-[10px] text-amber-600/70">Nicht bespielbar</span>
          )}
          <span className="text-[10px] text-amber-600/60 dark:text-amber-400/60 font-mono">
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
              ? "bg-gradient-to-br from-[#E25B36]/20 via-[#18202F] to-[#121824] border-[#E25B36]/60 dark:border-[#E25B36]/70 text-white ring-1 ring-[#E25B36]/30 shadow-sm"
              : "bg-white/90 dark:bg-[#141A26]/95 border-slate-200/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/15"
          }`}
        >
          {/* Top Line: Player Avatar + Status */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 truncate">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                  isMyBooking
                    ? "bg-[#E25B36] shadow-xs"
                    : "bg-slate-600 dark:bg-slate-700"
                }`}
              >
                {organizerInitials}
              </div>
              <span className="font-bold text-xs truncate">
                {booking.organizer?.firstName} {booking.organizer?.lastName}
              </span>
            </div>

            {isMyBooking ? (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#E25B36] text-white shadow-xs">
                Mein Match
              </span>
            ) : (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
                Belegt
              </span>
            )}
          </div>

          {/* Middle: Opponent / Guest */}
          <div className="flex items-center justify-between text-[11px] opacity-85 gap-1 truncate">
            {opponentName ? (
              <span className="truncate">vs. {opponentName}</span>
            ) : (
              <span className="italic text-[10px] opacity-70">Einzel-Reservierung</span>
            )}
            {booking.hasBallMachine && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-400/30 shrink-0">
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

    // 3. Freier Slot (Available) - Minimalist & Whisper Quiet (No sensory overload)
    return (
      <div
        key={`${court.id}-${hour}`}
        onClick={() => !past && onSelectSlot(court.id, timeStr)}
        className={`group relative h-24 rounded-2xl border transition-all flex flex-col items-center justify-center p-2.5 ${
          past
            ? "border-transparent bg-transparent opacity-25 dark:opacity-20 cursor-not-allowed"
            : "border-slate-200/60 dark:border-white/[0.04] bg-white/70 dark:bg-[#121824]/60 hover:border-[#E25B36]/60 dark:hover:border-[#E25B36]/70 hover:bg-[#E25B36]/[0.05] dark:hover:bg-[#E25B36]/[0.08] hover:shadow-sm cursor-pointer"
        }`}
      >
        {past ? (
          <div className="flex flex-col items-center justify-center text-slate-400 text-center">
            <Clock className="w-3.5 h-3.5 mb-0.5 opacity-40" />
            <span className="text-[10px] font-medium font-mono">{timeStr}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center w-full">
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 group-hover:text-[#E25B36] dark:group-hover:text-[#F37957] transition-colors">
              {timeStr}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-600 group-hover:hidden mt-0.5">
              Frei
            </span>
            <span className="hidden group-hover:inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-white bg-[#E25B36] px-2 py-0.5 rounded-lg shadow-2xs">
              <Plus className="w-3 h-3" /> Buchen
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
                    ? "bg-[#E25B36] text-white shadow-md shadow-[#E25B36]/25 scale-102"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-[#141A26] dark:text-slate-300 dark:border-white/[0.06]"
                }`}
              >
                {court.name}
              </button>
            );
          })}
        </div>

        {/* Selected Court Hero Card */}
        {activeCourt && activeCourtSurface && (
          <div className="relative overflow-hidden p-4 rounded-3xl bg-white/95 dark:bg-[#141A26]/95 border border-slate-200/90 dark:border-white/[0.06] shadow-xs backdrop-blur-xl">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${activeCourtSurface.barColor}`} />
            <div className="flex items-center justify-between gap-2 mt-1">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {activeCourt.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>{activeCourt.isIndoor ? "🏢 Hallenplatz" : "☀️ Freiplatz"}</span>
                  {activeCourt.hasLighting && (
                    <span className="text-amber-500 font-medium">
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
                    className="p-3.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] dark:bg-amber-500/[0.07] dark:border-amber-500/20 flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center font-mono w-14 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        <span className="text-xs font-bold">{timeStr}</span>
                        <span className="text-[10px] opacity-75">{nextHourStr}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                          <Wrench className="w-3.5 h-3.5 text-amber-500" />
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
                          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                            {block.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
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
                        ? "bg-gradient-to-r from-[#E25B36]/20 to-[#141A26] border-[#E25B36]/60 dark:border-[#E25B36]/70 text-white ring-1 ring-[#E25B36]/25 shadow-sm"
                        : "bg-white dark:bg-[#141A26] border-slate-200/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-200"
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
                            isMyBooking ? "bg-[#E25B36] shadow-xs" : "bg-slate-600 dark:bg-slate-700"
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
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[#E25B36] text-white shadow-xs">
                          Mein Match
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
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
                      ? "border-transparent bg-transparent opacity-25 dark:opacity-20 cursor-not-allowed"
                      : "border-slate-200/70 dark:border-white/[0.05] bg-white/90 dark:bg-[#141A26]/80 hover:border-[#E25B36]/60 dark:hover:border-[#E25B36]/70 active:scale-[0.98] cursor-pointer shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex flex-col items-center justify-center font-mono w-14 py-1 rounded-xl ${
                        past
                          ? "bg-slate-200/50 text-slate-400 dark:bg-slate-800"
                          : "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-bold"
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
                      className="h-8 px-3.5 rounded-xl bg-[#E25B36] hover:bg-[#C84B2B] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs shadow-[#E25B36]/20"
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
      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/90 dark:border-white/[0.06] bg-white/95 dark:bg-[#101522]/95 shadow-sm backdrop-blur-xl">
        <div
          className="min-w-full"
          style={{
            display: "grid",
            gridTemplateColumns: `85px repeat(${courts.length}, minmax(190px, 1fr))`,
          }}
        >
          {/* Header Row: Time spacer + Court Headers */}
          <div className="sticky top-0 z-20 bg-slate-50/95 dark:bg-[#141A26]/95 backdrop-blur-md p-3.5 border-b border-r border-slate-200 dark:border-white/[0.06] flex flex-col items-center justify-center">
            <span className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Uhrzeit
            </span>
          </div>

          {courts.map((court) => {
            const surfaceMeta = getSurfaceBadge(court.surface);
            return (
              <div
                key={court.id}
                className="sticky top-0 z-20 bg-slate-50/95 dark:bg-[#141A26]/95 backdrop-blur-md p-3.5 border-b border-r border-slate-200 dark:border-white/[0.06] last:border-r-0 relative overflow-hidden"
              >
                {/* Surface Accent Line */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${surfaceMeta.barColor}`} />

                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {court.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                      {court.sportType === "PADEL" ? "Padel" : "Tennis"}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${surfaceMeta.color}`}>
                    {surfaceMeta.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    {court.isIndoor ? "🏢 Halle" : "☀️ Freiplatz"}
                    {court.hasLighting && (
                      <span className="text-amber-500 font-semibold">
                        • 💡
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
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
              <div className="p-3 border-b border-r border-slate-100 dark:border-white/[0.04] bg-slate-50/60 dark:bg-[#141A26]/50 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                  {formatHour(hour)}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                  {formatHour(hour + 1)}
                </span>
              </div>

              {/* Court Slots for this Hour */}
              {courts.map((court) => (
                <div
                  key={`slot-${court.id}-${hour}`}
                  className="p-1.5 border-b border-r border-slate-100 dark:border-white/[0.04] last:border-r-0"
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
