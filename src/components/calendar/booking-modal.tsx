"use client";

import { useState } from "react";
import { Court, UserSummary } from "@/types";
import { createBookingAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Calendar, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              🎾 Platz reservieren
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reserviere deinen Tennisplatz nach Club-Regeln
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Court Selection */}
          <div>
            <Label htmlFor="court">Tennisplatz</Label>
            <select
              id="court"
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name} ({court.surface === "CLAY" ? "Sand" : "Hartplatz"}
                  {court.isIndoor ? " • Halle" : " • Outdoor"}
                  {court.hasLighting ? " • Flutlicht" : ""})
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Datum</Label>
              <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 text-slate-700 text-sm dark:bg-slate-800 dark:text-slate-300 font-medium">
                <Calendar className="w-4 h-4 text-emerald-600" />
                {selectedDateStr}
              </div>
            </div>
            <div>
              <Label htmlFor="time">Startzeit</Label>
              <Input
                id="time"
                type="time"
                step="1800"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <Label>Spieldauer</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setDurationMinutes(60)}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  durationMinutes === 60
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                60 Minuten (1 Stunde)
              </button>
              <button
                type="button"
                onClick={() => setDurationMinutes(90)}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  durationMinutes === 90
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                90 Minuten (1.5 Stunden)
              </button>
            </div>
          </div>

          {/* Match Type */}
          <div>
            <Label>Spielart</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setMatchType("SINGLE")}
                className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                  matchType === "SINGLE"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Einzel Match
              </button>
              <button
                type="button"
                onClick={() => setMatchType("DOUBLE")}
                className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                  matchType === "DOUBLE"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Doppel Match
              </button>
            </div>
          </div>

          {/* Match & Opponent Details */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Mitspieler / Spielpartner</Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpponentType("MEMBER")}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    opponentType === "MEMBER"
                      ? "bg-emerald-100 text-emerald-800 font-semibold dark:bg-emerald-900/60 dark:text-emerald-300"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Clubmitglied
                </button>
                <button
                  type="button"
                  onClick={() => setOpponentType("GUEST")}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    opponentType === "GUEST"
                      ? "bg-emerald-100 text-emerald-800 font-semibold dark:bg-emerald-900/60 dark:text-emerald-300"
                      : "text-slate-500 hover:text-slate-900"
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
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                required
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Bemerkungen (optional)</Label>
            <Input
              id="notes"
              type="text"
              placeholder="z.B. Einzel-Training, Match-Vorbereitung"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* Rules hint */}
          <div className="rounded-lg bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-start gap-2 border border-emerald-100 dark:border-emerald-900/50">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-semibold">Club-Buchungsregeln:</p>
              <p className="mt-0.5">
                Kostenlose Stornierung bis 24 Stunden vor Spielbeginn. Bei Regen kann der Platz
                jederzeit storniert werden.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Reservierung bestätigen
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
