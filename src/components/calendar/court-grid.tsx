"use client";

import { Court, Booking, CourtBlock } from "@/types";
import { Clock, Plus, Wrench, Trophy, Sparkles } from "lucide-react";
import { formatTime24 } from "@/lib/utils";

interface CourtGridProps {
  courts: Court[];
  bookings: Booking[];
  courtBlocks: CourtBlock[];
  dateStr: string; // YYYY-MM-DD
  openingHour?: number;
  closingHour?: number;
  currentUserId?: string;
  activeCategory: "ALL" | "HARD" | "CLAY" | "PADEL";
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
  activeCategory,
  onSelectSlot,
  onSelectBooking,
}: CourtGridProps) {
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

  const getSurfaceBadge = (surface: string, sportType?: string) => {
    if (sportType === "PADEL") {
      return {
        label: "Padel",
        dotColor: "bg-cyan-500",
        color: "text-cyan-800 bg-cyan-100 border-cyan-300 dark:text-cyan-300 dark:bg-cyan-950/80 dark:border-cyan-500/40",
        barColor: "bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]",
      };
    }
    switch (surface) {
      case "HARD":
        return {
          label: "Allwetter",
          dotColor: "bg-blue-500",
          color: "text-blue-800 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-950/80 dark:border-blue-500/40",
          barColor: "bg-blue-500 shadow-[0_0_10px_rgba(96,165,250,0.5)]",
        };
      case "CLAY":
        return {
          label: "Sand (Clay)",
          dotColor: "bg-[#FF6E40]",
          color: "text-orange-900 bg-orange-100 border-orange-300 dark:text-[#FF8A65] dark:bg-orange-950/80 dark:border-orange-500/40",
          barColor: "bg-[#FF6E40] shadow-[0_0_10px_rgba(255,110,64,0.5)]",
        };
      default:
        return {
          label: surface,
          dotColor: "bg-slate-400",
          color: "text-slate-700 bg-slate-100 border-slate-300 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700",
          barColor: "bg-slate-400",
        };
    }
  };

  // Filtered by quick category
  const displayedCourts = courts.filter((court) => {
    if (activeCategory === "ALL") return true;
    if (activeCategory === "PADEL") return court.sportType === "PADEL";
    if (activeCategory === "HARD") return court.surface === "HARD";
    if (activeCategory === "CLAY") return court.surface === "CLAY";
    return true;
  });

  const renderSlotCell = (court: Court, hour: number) => {
    const booking = getBookingForSlot(court.id, hour);
    const block = getCourtBlockForSlot(court.id, hour);
    const past = isPastSlot(hour);
    const timeStr = formatHour(hour);

    // 1. Court Block (Platzpflege / Sperre)
    if (block) {
      return (
        <div
          key={`${court.id}-${hour}`}
          className="relative h-20 p-2.5 rounded-xl border border-amber-500/30 bg-[#241A08] text-amber-200 flex flex-col justify-between overflow-hidden shadow-sm m-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 truncate">
              <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                {block.reason === "MAINTENANCE"
                  ? "Platzpflege"
                  : block.reason === "TOURNAMENT"
                  ? "Clubturnier"
                  : "Gesperrt"}
              </span>
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500 text-slate-950">
              Sperre
            </span>
          </div>
          <p className="text-[10px] text-amber-300/80 truncate">
            {block.description || "Nicht bespielbar"}
          </p>
          <span className="text-[9px] text-amber-400/60 font-mono">
            {timeStr} – {formatHour(hour + 1)}
          </span>
        </div>
      );
    }

    // 2. Gebuchter Slot (High Contrast Luxury SaaS Cards - Image 1 Style!)
    if (booking) {
      const isMyBooking =
        currentUserId &&
        (booking.organizerId === currentUserId ||
          booking.participants.some((p) => p.userId === currentUserId));

      const isTournament =
        booking.bookingType === "TOURNAMENT" ||
        booking.notes?.toLowerCase().includes("universitaire");
      
      const isAnybuddy =
        booking.bookingType === "GUEST" ||
        booking.notes?.toLowerCase().includes("anybuddy") ||
        booking.participants.some((p) => p.guestName?.includes("Anybuddy"));

      const opponent = booking.participants.find((p) => p.role !== "ORGANIZER");
      const opponentName = opponent?.user
        ? `${opponent.user.firstName} ${opponent.user.lastName}`
        : opponent?.guestName;

      const organizerName = booking.organizer
        ? `${booking.organizer.firstName} ${booking.organizer.lastName}`
        : "Mitglied";

      const organizerInitials = booking.organizer
        ? `${booking.organizer.firstName?.[0] || ""}${booking.organizer.lastName?.[0] || ""}`.toUpperCase()
        : "TC";

      // Card Styles: Vercel/Linear Minimalist Pastel (Soft, clean, glassmorphic)
      let cardContainerStyle =
        "bg-orange-100/60 border border-orange-200/60 text-orange-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:bg-[#FF6E40]/10 dark:border-[#FF6E40]/20 dark:text-orange-200";
      let tagText = "Réservé";
      let tagStyle =
        "bg-orange-500/10 text-orange-700 font-semibold dark:bg-[#FF6E40]/20 dark:text-orange-300";
      let avatarBg = "bg-orange-400 dark:bg-[#FF6E40]";

      if (isTournament) {
        cardContainerStyle =
          "bg-emerald-100/60 border border-emerald-200/60 text-emerald-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300";
        tagText = "🏆 Turnier";
        tagStyle = "bg-emerald-500/10 text-emerald-700 font-semibold dark:bg-emerald-500/20 dark:text-emerald-300";
        avatarBg = "bg-emerald-400 dark:bg-emerald-500";
      } else if (isAnybuddy) {
        cardContainerStyle =
          "bg-purple-100/60 border border-purple-200/60 text-purple-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-300";
        tagText = "Anybuddy";
        tagStyle = "bg-purple-500/10 text-purple-700 font-semibold dark:bg-purple-500/20 dark:text-purple-300";
        avatarBg = "bg-purple-400 dark:bg-purple-500";
      } else if (isMyBooking) {
        cardContainerStyle =
          "bg-blue-100/60 border border-blue-200/60 text-blue-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-200";
        tagText = "Mein Match";
        tagStyle = "bg-blue-500/10 text-blue-700 font-semibold dark:bg-blue-500/20 dark:text-blue-300";
        avatarBg = "bg-[#2563EB]";
      }

      return (
        <div
          key={`${court.id}-${hour}`}
          onClick={() => onSelectBooking(booking)}
          className={`group relative h-20 p-2.5 rounded-[12px] cursor-pointer transition-all duration-200 ease-out flex flex-col justify-between overflow-hidden hover:scale-[1.02] hover:shadow-md m-0.5 ${cardContainerStyle}`}
        >
          {/* Top Line: Avatar + Name + Status Tag */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${avatarBg}`}
              >
                {isTournament ? "🇨🇭" : organizerInitials}
              </div>
              <span className="font-bold text-xs text-slate-900 dark:text-white truncate tracking-tight">
                {isTournament ? (booking.notes || "Turnier") : organizerName}
              </span>
            </div>

            <span className={`shrink-0 px-1.5 py-0.2 rounded-full text-[9px] ${tagStyle}`}>
              {tagText}
            </span>
          </div>

          {/* Middle: Opponent or Notes */}
          <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-200 gap-1 truncate font-medium">
            {opponentName ? (
              <span className="truncate opacity-90">vs. {opponentName}</span>
            ) : booking.notes && !isTournament ? (
              <span className="truncate italic text-slate-600 dark:text-slate-300 text-[10px]">„{booking.notes}“</span>
            ) : (
              <span className="opacity-70 text-[10px]">{isTournament ? "Gesperrt für Event" : "Einzel"}</span>
            )}

            {booking.hasBallMachine && (
              <span className="text-[8px] font-bold px-1 rounded bg-amber-400 text-slate-950 shrink-0">
                🎾 Ball
              </span>
            )}
          </div>

          {/* Bottom: Time */}
          <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {formatTime24(booking.startsAt)} - {formatTime24(booking.endsAt)}
            </span>
            {booking.hasLighting && <span>💡</span>}
          </div>
        </div>
      );
    }

    // 3. Freier Slot (Clickable)
    return (
      <div
        key={`${court.id}-${hour}`}
        onClick={() => !past && onSelectSlot(court.id, timeStr)}
        className={`group relative h-20 rounded-[12px] transition-all duration-200 ease-out flex flex-col items-center justify-center p-2 select-none m-0.5 ${
          past
            ? "opacity-30 cursor-not-allowed"
            : "bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-200/60 dark:hover:bg-white/[0.02] dark:hover:border-white/[0.05] active:scale-[0.98] cursor-pointer"
        }`}
      >
        {!past && (
          <div className="flex flex-col items-center justify-center text-center w-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {timeStr}
            </span>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-blue-700 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300 px-2 py-0.5 rounded-full">
              <Plus className="w-3 h-3" /> Buchen
            </span>
          </div>
        )}
      </div>
    );
  };

  if (courts.length === 0) {
    return (
      <div className="py-20 text-center rounded-3xl bg-[#0D121D] border border-white/5 p-8 text-slate-400">
        <span className="text-3xl mb-2 block">🎾</span>
        <h3 className="text-base font-bold text-white">Keine Plätze für diese Kategorie</h3>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-3xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overscroll-contain select-none transition-colors scrollbar-hide">
      <div
        className="min-w-max"
        style={{
          display: "grid",
          gridTemplateColumns: `70px repeat(${displayedCourts.length}, minmax(170px, 1fr))`,
        }}
      >
        {/* ======================================================== */}
        {/* Top-Left Corner Intersection (Sticky Top + Sticky Left) */}
        {/* ======================================================== */}
        <div className="sticky top-0 left-0 z-40 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl p-3 border-b border-r border-slate-200 dark:border-white/[0.08] flex flex-col items-center justify-center transition-colors">
          <span className="font-semibold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
            Zeit
          </span>
        </div>

        {/* ======================================================== */}
        {/* Top Court Headers (Sticky Top)                          */}
        {/* ======================================================== */}
        {displayedCourts.map((court) => {
          const surfaceMeta = getSurfaceBadge(court.surface, court.sportType);
          return (
            <div
              key={`header-${court.id}`}
              className="sticky top-0 z-30 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl p-3 border-b border-r border-slate-200 dark:border-white/[0.08] last:border-r-0 relative overflow-hidden transition-colors"
            >
              {/* Surface Accent Bar - Softened */}
              <div className={`absolute top-0 left-0 right-0 h-1 opacity-50 ${surfaceMeta.barColor}`} />

              <div className="flex items-center justify-between gap-1 mb-1 mt-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`w-2 h-2 rounded-full ${surfaceMeta.dotColor} shrink-0 opacity-80`} />
                  <span className="font-bold text-[13px] text-slate-800 dark:text-slate-200 truncate tracking-tight">
                    {court.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-medium mt-2">
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-medium border ${surfaceMeta.color} opacity-80`}>
                  {surfaceMeta.label}
                </span>
                <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-mono">
                  {court.hasLighting && <span title="Flutlicht vorhanden" className="opacity-70">💡</span>}
                  <span>{court.hourlyRate}.-</span>
                </span>
              </div>
            </div>
          );
        })}

        {/* ======================================================== */}
        {/* Time Rows & Court Slots                                  */}
        {/* ======================================================== */}
        {hours.map((hour) => (
          <div key={`row-${hour}`} className="contents">
            {/* Sticky Time Column Cell (Sticky Left) */}
            <div className="sticky left-0 z-20 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md p-2 border-b border-r border-slate-200 dark:border-white/[0.08] flex flex-col items-center justify-center transition-colors">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 font-mono">
                {formatHour(hour)}
              </span>
            </div>

            {/* Slot cells for each court */}
            {displayedCourts.map((court) => (
              <div
                key={`slot-${court.id}-${hour}`}
                className="p-1 border-b border-r border-slate-200/80 dark:border-white/[0.07] last:border-r-0 bg-transparent"
              >
                {renderSlotCell(court, hour)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
