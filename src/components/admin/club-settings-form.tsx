"use client";

import { useState } from "react";
import { TenantSettings } from "@/types";
import { updateClubSettingsAction } from "@/app/actions/club-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Clock, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ClubSettingsFormProps {
  clubSlug: string;
  initialSettings?: TenantSettings | null;
}

export function ClubSettingsForm({
  clubSlug,
  initialSettings,
}: ClubSettingsFormProps) {
  const [openingHour, setOpeningHour] = useState<number>(
    initialSettings?.openingHour ?? 7
  );
  const [closingHour, setClosingHour] = useState<number>(
    initialSettings?.closingHour ?? 22
  );
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<number>(
    initialSettings?.slotDurationMinutes ?? 60
  );
  const [cancellationDeadlineHours, setCancellationDeadlineHours] =
    useState<number>(initialSettings?.cancellationDeadlineHours ?? 24);
  const [allowGuestBookings, setAllowGuestBookings] = useState<boolean>(
    initialSettings?.allowGuestBookings ?? true
  );

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await updateClubSettingsAction(clubSlug, {
        openingHour: Number(openingHour),
        closingHour: Number(closingHour),
        slotDurationMinutes: Number(slotDurationMinutes),
        cancellationDeadlineHours: Number(cancellationDeadlineHours),
        allowGuestBookings,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: "Club-Einstellungen und Öffnungszeiten erfolgreich gespeichert!",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Speichern fehlgeschlagen.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Ein unerwarteter Fehler ist aufgetreten.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          Öffnungszeiten & Buchungsregeln
        </CardTitle>
        <CardDescription className="text-xs">
          Definiere die Betriebszeiten des Clubs, Stornofristen und Spielzeit-Regeln.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="openingHour" className="text-xs font-medium">
                Club-Öffnung (Uhrzeit)
              </Label>
              <select
                id="openingHour"
                value={openingHour}
                onChange={(e) => setOpeningHour(Number(e.target.value))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                {[6, 7, 8, 9, 10].map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00 Uhr
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="closingHour" className="text-xs font-medium">
                Club-Schliessung (Uhrzeit)
              </Label>
              <select
                id="closingHour"
                value={closingHour}
                onChange={(e) => setClosingHour(Number(e.target.value))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                {[19, 20, 21, 22, 23, 24].map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00 Uhr
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="slotDurationMinutes" className="text-xs font-medium">
                Standard Slot-Dauer
              </Label>
              <select
                id="slotDurationMinutes"
                value={slotDurationMinutes}
                onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                <option value={45}>45 Minuten</option>
                <option value={60}>60 Minuten (1 Stunde)</option>
                <option value={90}>90 Minuten (1.5 Stunden)</option>
                <option value={120}>120 Minuten (2 Stunden)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cancellationDeadlineHours" className="text-xs font-medium">
                Storno-Frist für Mitglieder
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cancellationDeadlineHours"
                  type="number"
                  min={0}
                  max={72}
                  value={cancellationDeadlineHours}
                  onChange={(e) =>
                    setCancellationDeadlineHours(Number(e.target.value))
                  }
                  className="text-xs"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Stunden vorher
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowGuestBookings}
                onChange={(e) => setAllowGuestBookings(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <div>
                <p className="text-xs font-medium text-slate-900 dark:text-white">
                  Gastbuchungen erlauben
                </p>
                <p className="text-[11px] text-slate-500">
                  Erlaube nicht registrierten Spielern, freie Slots anzufragen oder zu buchen.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Einstellungen speichern
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
