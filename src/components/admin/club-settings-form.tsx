"use client";

import { useState } from "react";
import { TenantSettings } from "@/types";
import { updateClubSettingsAction } from "@/app/actions/club-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Coins,
} from "lucide-react";

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

  // Epic settings
  const [allowConsecutiveSlotsForDoubles, setAllowConsecutiveSlotsForDoubles] = useState<boolean>(
    initialSettings?.allowConsecutiveSlotsForDoubles ?? true
  );
  const [marlyRuleEnabled, setMarlyRuleEnabled] = useState<boolean>(
    initialSettings?.marlyRuleEnabled ?? true
  );
  const [marlyCooldownMinutes, setMarlyCooldownMinutes] = useState<number>(
    initialSettings?.marlyCooldownMinutes ?? 60
  );
  const [maxActiveSlotsPerPlayer, setMaxActiveSlotsPerPlayer] = useState<number>(
    initialSettings?.maxActiveSlotsPerPlayer ?? 2
  );
  const [ballMachineFee, setBallMachineFee] = useState<number>(
    initialSettings?.ballMachineFee ?? 10
  );
  const [floodlightFee, setFloodlightFee] = useState<number>(
    initialSettings?.floodlightFee ?? 5
  );
  const [guestFee, setGuestFee] = useState<number>(
    initialSettings?.guestFee ?? 15
  );
  const [defaultHourlyRateTennis, setDefaultHourlyRateTennis] = useState<number>(
    initialSettings?.defaultHourlyRateTennis ?? 30
  );
  const [defaultHourlyRateHalle, setDefaultHourlyRateHalle] = useState<number>(
    initialSettings?.defaultHourlyRateHalle ?? 45
  );
  const [defaultHourlyRatePadel, setDefaultHourlyRatePadel] = useState<number>(
    initialSettings?.defaultHourlyRatePadel ?? 40
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
        allowConsecutiveSlotsForDoubles,
        marlyRuleEnabled,
        marlyCooldownMinutes: Number(marlyCooldownMinutes),
        maxActiveSlotsPerPlayer: Number(maxActiveSlotsPerPlayer),
        ballMachineFee: Number(ballMachineFee),
        floodlightFee: Number(floodlightFee),
        guestFee: Number(guestFee),
        defaultHourlyRateTennis: Number(defaultHourlyRateTennis),
        defaultHourlyRateHalle: Number(defaultHourlyRateHalle),
        defaultHourlyRatePadel: Number(defaultHourlyRatePadel),
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: "Club-Einstellungen und Buchungsregeln erfolgreich gespeichert!",
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
          Club-Regeln, Tarife & Fairplay-System
        </CardTitle>
        <CardDescription className="text-xs">
          Definiere Betriebszeiten, TC Marly Fairplay-Regeln, Doppel-Verlängerung und Gebühren.
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

          {/* Section 1: Times & Durations */}
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
                Standard Slot-Dauer (Einzel)
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
                  onChange={(e) => setCancellationDeadlineHours(Number(e.target.value))}
                  className="text-xs"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Stunden vorher
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Fairplay & Marly-Modell */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              TC Marly Fairplay-Regeln & Rolling Slot Release
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marlyRuleEnabled}
                  onChange={(e) => setMarlyRuleEnabled(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Marly-Regel aktivieren
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Keine Doppel-Stunden im Einzel & Rolling Release nach Ablauf des Spiels.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowConsecutiveSlotsForDoubles}
                  onChange={(e) => setAllowConsecutiveSlotsForDoubles(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    2h Doppel-Spezial erlauben
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Erlaubt 2 Stunden am Stück, wenn 4 Spieler im Doppel antreten.
                  </p>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="space-y-1">
                <Label htmlFor="maxActiveSlots" className="text-xs">
                  Max. aktive Reservierungen pro Spieler
                </Label>
                <Input
                  id="maxActiveSlots"
                  type="number"
                  min={1}
                  max={10}
                  value={maxActiveSlotsPerPlayer}
                  onChange={(e) => setMaxActiveSlotsPerPlayer(Number(e.target.value))}
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cooldown" className="text-xs">
                  Mindestabstand / Cooldown (Minuten)
                </Label>
                <Input
                  id="cooldown"
                  type="number"
                  min={0}
                  step={15}
                  value={marlyCooldownMinutes}
                  onChange={(e) => setMarlyCooldownMinutes(Number(e.target.value))}
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Fees & Multi-Sport Tarife */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-600" />
              Gebühren, Equipment & Multi-Sport Stundensätze (CHF)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="guestFee" className="text-xs">
                  Gastgebühr / Spieler
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="guestFee"
                    type="number"
                    min={0}
                    value={guestFee}
                    onChange={(e) => setGuestFee(Number(e.target.value))}
                    className="text-xs h-8"
                  />
                  <span className="text-xs text-slate-500">CHF</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ballMachineFee" className="text-xs">
                  Ballmaschine / Stunde
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="ballMachineFee"
                    type="number"
                    min={0}
                    value={ballMachineFee}
                    onChange={(e) => setBallMachineFee(Number(e.target.value))}
                    className="text-xs h-8"
                  />
                  <span className="text-xs text-slate-500">CHF</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="floodlightFee" className="text-xs">
                  Flutlicht-Zuschlag
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="floodlightFee"
                    type="number"
                    min={0}
                    value={floodlightFee}
                    onChange={(e) => setFloodlightFee(Number(e.target.value))}
                    className="text-xs h-8"
                  />
                  <span className="text-xs text-slate-500">CHF</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="space-y-1">
                <Label htmlFor="rateTennis" className="text-xs">
                  Tennis Sand (Gast)
                </Label>
                <Input
                  id="rateTennis"
                  type="number"
                  min={0}
                  value={defaultHourlyRateTennis}
                  onChange={(e) => setDefaultHourlyRateTennis(Number(e.target.value))}
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rateHalle" className="text-xs">
                  Tennishalle / h
                </Label>
                <Input
                  id="rateHalle"
                  type="number"
                  min={0}
                  value={defaultHourlyRateHalle}
                  onChange={(e) => setDefaultHourlyRateHalle(Number(e.target.value))}
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="ratePadel" className="text-xs">
                  Padel Court / h
                </Label>
                <Input
                  id="ratePadel"
                  type="number"
                  min={0}
                  value={defaultHourlyRatePadel}
                  onChange={(e) => setDefaultHourlyRatePadel(Number(e.target.value))}
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowGuestBookings}
                onChange={(e) => setAllowGuestBookings(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs font-semibold cursor-pointer shadow-xs"
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
