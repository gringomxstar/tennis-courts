"use client";

import { useState } from "react";
import { Court, UserSummary } from "@/types";
import { createBookingAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubSlug: string;
  courts: Court[];
  members: UserSummary[];
  currentUserId?: string;
  selectedCourtId?: string;
  selectedDateStr: string; // YYYY-MM-DD
  selectedTimeStr: string; // HH:mm
}

function getEndTimeStr(startTimeStr: string, durationMinutes: number): string {
  const [hStr, mStr] = startTimeStr.split(":");
  const h = parseInt(hStr || "10", 10);
  const m = parseInt(mStr || "00", 10);
  const totalM = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalM / 60) % 24;
  const endM = totalM % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function BookingModal({
  isOpen,
  onClose,
  clubSlug,
  courts,
  members,
  currentUserId,
  selectedCourtId,
  selectedDateStr,
  selectedTimeStr,
}: BookingModalProps) {
  const [courtId, setCourtId] = useState(selectedCourtId || courts[0]?.id || "");
  const [time, setTime] = useState(selectedTimeStr || "10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [matchType, setMatchType] = useState<"SINGLE" | "DOUBLE">("SINGLE");
  const [opponentType, setOpponentType] = useState<"MEMBER" | "GUEST">("MEMBER");
  const [opponentUserId, setOpponentUserId] = useState(
    members.find((m) => m.id !== currentUserId)?.id || ""
  );
  const [guestName, setGuestName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustControls, setShowAdjustControls] = useState(false);

  if (!isOpen) return null;

  const currentCourt = courts.find((c) => c.id === courtId) || courts[0];
  const endTime = getEndTimeStr(time, durationMinutes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Combine date + time to ISO
    const startsAt = new Date(`${selectedDateStr}T${time}:00`).toISOString();

    const res = await createBookingAction({
      clubSlug,
      courtId,
      startsAt,
      durationMinutes,
      bookingType: "MEMBER",
      opponentUserId: opponentType === "MEMBER" ? opponentUserId : undefined,
      guestName: opponentType === "GUEST" ? guestName : undefined,
      notes: notes.trim() || undefined,
    });

    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || "Fehler beim Erstellen der Reservierung.");
    }
  };

  const getSurfaceLabel = (surface?: string) => {
    switch (surface) {
      case "CLAY":
        return "Sand (Clay)";
      case "HARD":
        return "Hartplatz";
      case "ARTIFICIAL_GRASS":
        return "Kunstrasen";
      case "CARPET":
        return "Teppich";
      default:
        return surface || "Standard";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              🎾 Platz reservieren
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bestätige dein Tennis-Match nach offiziellen Club-Regeln
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Selected Slot Highlight Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-500/30 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                {currentCourt?.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                {getSurfaceLabel(currentCourt?.surface)}
              </span>
              {currentCourt?.isIndoor ? (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Halle</span>
              ) : (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Outdoor</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {selectedDateStr}
              </span>
              <span className="flex items-center gap-1.5 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                {time} – {endTime} Uhr ({durationMinutes} Min)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdjustControls(!showAdjustControls)}
            className="shrink-0 p-2 rounded-xl bg-white/80 hover:bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:text-emerald-600 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer transition-all"
            title="Platz oder Startzeit anpassen"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Anpassen</span>
          </button>
        </div>

        {/* Optional Collapsible Adjust Controls */}
        {showAdjustControls && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
            <div>
              <Label htmlFor="court" className="text-xs">Tennisplatz</Label>
              <select
                id="court"
                value={courtId}
                onChange={(e) => setCourtId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-xs focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name} ({getSurfaceLabel(court.surface)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="time" className="text-xs">Startzeit</Label>
              <Input
                id="time"
                type="time"
                step="1800"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 text-xs h-8"
                required
              />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Duration Selector */}
          <div>
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Spieldauer
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setDurationMinutes(60)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  durationMinutes === 60
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                60 Minuten (1 Stunde)
              </button>
              <button
                type="button"
                onClick={() => setDurationMinutes(90)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  durationMinutes === 90
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                90 Minuten (1.5 Stunden)
              </button>
            </div>
          </div>

          {/* Match Type */}
          <div>
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Spielart
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setMatchType("SINGLE")}
                className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  matchType === "SINGLE"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Einzel Match (1 vs 1)
              </button>
              <button
                type="button"
                onClick={() => setMatchType("DOUBLE")}
                className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  matchType === "DOUBLE"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Doppel Match (2 vs 2)
              </button>
            </div>
          </div>

          {/* Match & Opponent Details */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mitspieler / Spielpartner
              </Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpponentType("MEMBER")}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                    opponentType === "MEMBER"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  Clubmitglied
                </button>
                <button
                  type="button"
                  onClick={() => setOpponentType("GUEST")}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                    opponentType === "GUEST"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  Gastspieler
                </button>
              </div>
            </div>

            {opponentType === "MEMBER" ? (
              <select
                value={opponentUserId}
                onChange={(e) => setOpponentUserId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs shadow-xs focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {members
                  .filter((m) => m.id !== currentUserId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.email})
                    </option>
                  ))}
              </select>
            ) : (
              <Input
                type="text"
                placeholder="Name des Gastes (z.B. Martina Hingis)"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="text-xs rounded-xl"
                required
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Bemerkungen (optional)
            </Label>
            <Input
              id="notes"
              type="text"
              placeholder="z.B. Ranglistenspiel, Vorbereitung"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 text-xs rounded-xl"
            />
          </div>

          {/* Rules hint */}
          <div className="rounded-2xl bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-start gap-2.5 border border-emerald-100 dark:border-emerald-900/50">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-bold">Club-Buchungsregeln:</p>
              <p className="mt-0.5 opacity-90">
                Kostenlose Stornierung bis 24 Stunden vor Spielbeginn. Bei Unbespielbarkeit (z.B. Regen) kann der Platz jederzeit storniert werden.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl text-xs"
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-2 shadow-xs shadow-emerald-600/20"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Reservierung verbindlich buchen
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
