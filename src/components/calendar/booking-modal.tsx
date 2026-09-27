"use client";

import { useState, useMemo } from "react";
import { Court, UserSummary, Tenant } from "@/types";
import { createBookingAction, topUpWalletAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  SlidersHorizontal,
  Coins,
  Search,
  UserPlus,
  Users,
  Sparkles,
  Zap,
} from "lucide-react";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  courts: Court[];
  members: UserSummary[];
  currentUserId?: string;
  userWallet?: { balance: number; currency: string } | null;
  selectedCourtId?: string;
  selectedDateStr: string; // YYYY-MM-DD
  selectedTimeStr: string; // HH:mm
  existingBookings?: {
    courtId: string;
    startsAt: string;
    endsAt: string;
    hasBallMachine?: boolean;
    status?: string;
  }[];
}

interface ParticipantSlot {
  id: string;
  type: "MEMBER" | "GUEST";
  userId?: string;
  name: string;
  email?: string;
}

export function BookingModal({
  isOpen,
  onClose,
  tenant,
  courts,
  members,
  currentUserId,
  userWallet,
  selectedCourtId,
  selectedDateStr,
  selectedTimeStr,
  existingBookings = [],
}: BookingModalProps) {
  const [courtId, setCourtId] = useState(selectedCourtId || courts[0]?.id || "");
  const [time, setTime] = useState(selectedTimeStr || "10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [matchType, setMatchType] = useState<"SINGLE" | "DOUBLE">("SINGLE");

  // Wallet state with local balance tracking
  const [walletBalance, setWalletBalance] = useState(userWallet?.balance ?? 50);
  const [topUpLoading, setTopUpLoading] = useState(false);

  // Equipment add-ons
  const [hasBallMachine, setHasBallMachine] = useState(false);
  const [hasLighting, setHasLighting] = useState(false);

  // Participants list (excluding organizer)
  const defaultOpponent = members.find((m) => m.id !== currentUserId);
  const [participants, setParticipants] = useState<ParticipantSlot[]>(
    defaultOpponent
      ? [
          {
            id: `part-${defaultOpponent.id}`,
            type: "MEMBER",
            userId: defaultOpponent.id,
            name: `${defaultOpponent.firstName} ${defaultOpponent.lastName}`,
            email: defaultOpponent.email,
          },
        ]
      : []
  );

  // Quick search & manual guest input state
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [showAddGuest, setShowAddGuest] = useState(false);

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustControls, setShowAdjustControls] = useState(false);

  // Ball Machine Exclusivity check
  const ballMachineConflict = useMemo(() => {
    if (!isOpen || !existingBookings || existingBookings.length === 0) return null;
    const startMs = new Date(`${selectedDateStr}T${time}:00`).getTime();
    const endMs = startMs + durationMinutes * 60 * 1000;

    const conflict = existingBookings.find((b) => {
      if (b.status === "CANCELLED" || !b.hasBallMachine) return false;
      const bStart = new Date(b.startsAt).getTime();
      const bEnd = new Date(b.endsAt).getTime();
      return startMs < bEnd && endMs > bStart;
    });

    if (conflict) {
      const c = courts.find((court) => court.id === conflict.courtId);
      return c?.name || "einem anderen Platz";
    }
    return null;
  }, [isOpen, existingBookings, selectedDateStr, time, durationMinutes, courts]);

  if (!isOpen) return null;

  const currentCourt = courts.find((c) => c.id === courtId) || courts[0];
  const requiredPartnersCount = matchType === "SINGLE" ? 1 : 3;
  const isSquadFull = participants.length >= requiredPartnersCount;

  // Calculate end time string
  const [startHour, startMin] = time.split(":").map(Number);
  const endTotalMinutes = (startHour || 0) * 60 + (startMin || 0) + durationMinutes;
  const endHour = Math.floor(endTotalMinutes / 60) % 24;
  const endMinute = endTotalMinutes % 60;
  const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

  // Price Calculation
  const durationHours = durationMinutes / 60;
  let courtRate = 0;
  if (currentCourt?.sportType === "PADEL") {
    courtRate = (tenant.settingsJson?.defaultHourlyRatePadel ?? currentCourt.hourlyRate ?? 40) * durationHours;
  } else if (currentCourt?.isIndoor) {
    courtRate = (tenant.settingsJson?.defaultHourlyRateHalle ?? currentCourt.hourlyRate ?? 45) * durationHours;
  } else {
    // Outdoor tennis: included for members, 30 CHF/h for guests
    courtRate = currentUserId ? 0 : (tenant.settingsJson?.defaultHourlyRateTennis ?? 30) * durationHours;
  }

  const guestCount = participants.filter((p) => p.type === "GUEST").length;
  const guestFeePerPerson = tenant.settingsJson?.guestFee ?? 15;
  const totalGuestFee = guestCount * guestFeePerPerson;
  const ballMachineCost = hasBallMachine ? (tenant.settingsJson?.ballMachineFee ?? 10) * durationHours : 0;
  const lightingCost = hasLighting ? (tenant.settingsJson?.floodlightFee ?? 5) : 0;
  const totalCost = courtRate + totalGuestFee + ballMachineCost + lightingCost;

  // Top Up Action
  const handleQuickTopUp = async () => {
    setTopUpLoading(true);
    const res = await topUpWalletAction({ clubSlug: tenant.slug, amount: 50 });
    setTopUpLoading(false);
    if (res.success && res.balance !== undefined) {
      setWalletBalance(res.balance);
      setError(null);
    }
  };

  // Participant Management
  const addMemberParticipant = (member: UserSummary) => {
    if (participants.some((p) => p.userId === member.id)) return;
    if (participants.length >= requiredPartnersCount) {
      if (matchType === "SINGLE") {
        // Replace current opponent
        setParticipants([
          {
            id: `part-${member.id}`,
            type: "MEMBER",
            userId: member.id,
            name: `${member.firstName} ${member.lastName}`,
            email: member.email,
          },
        ]);
        return;
      }
      return;
    }
    setParticipants([
      ...participants,
      {
        id: `part-${member.id}`,
        type: "MEMBER",
        userId: member.id,
        name: `${member.firstName} ${member.lastName}`,
        email: member.email,
      },
    ]);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) return;
    if (participants.length >= requiredPartnersCount && matchType === "SINGLE") {
      setParticipants([
        {
          id: `guest-${Date.now()}`,
          type: "GUEST",
          name: newGuestName.trim(),
          email: newGuestEmail.trim() || undefined,
        },
      ]);
    } else if (participants.length < requiredPartnersCount) {
      setParticipants([
        ...participants,
        {
          id: `guest-${Date.now()}`,
          type: "GUEST",
          name: newGuestName.trim(),
          email: newGuestEmail.trim() || undefined,
        },
      ]);
    }
    setNewGuestName("");
    setNewGuestEmail("");
    setShowAddGuest(false);
  };

  // Switch Match Type handler
  const handleMatchTypeChange = (newType: "SINGLE" | "DOUBLE") => {
    setMatchType(newType);
    if (newType === "SINGLE") {
      if (durationMinutes === 120) setDurationMinutes(60);
      if (participants.length > 1) {
        setParticipants(participants.slice(0, 1));
      }
    }
  };

  // Frequently played partners (Buddy List)
  const buddyMembers = members.filter((m) => m.id !== currentUserId).slice(0, 4);

  // Filtered members for live search
  const filteredMembers = members.filter((m) => {
    if (m.id === currentUserId) return false;
    if (participants.some((p) => p.userId === m.id)) return false;
    if (!memberSearchQuery) return true;
    const query = memberSearchQuery.toLowerCase();
    return (
      m.firstName.toLowerCase().includes(query) ||
      m.lastName.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate participants
    if (participants.length < requiredPartnersCount) {
      setLoading(false);
      setError(
        matchType === "SINGLE"
          ? "Bitte wähle einen Spielpartner oder Gastspieler für das Einzel aus."
          : `Für ein Doppel müssen mindestens 3 Mitspieler ausgewählt werden (aktuell: ${participants.length}).`
      );
      return;
    }

    // Check credits
    if (totalCost > 0 && currentUserId && walletBalance < totalCost) {
      setLoading(false);
      setError(
        `Nicht genügend Guthaben (${walletBalance.toFixed(2)} CHF vorhanden, ${totalCost.toFixed(2)} CHF benötigt). Bitte lade kurz Test-Credits auf.`
      );
      return;
    }

    const startsAt = new Date(`${selectedDateStr}T${time}:00`).toISOString();

    const res = await createBookingAction({
      clubSlug: tenant.slug,
      courtId,
      startsAt,
      durationMinutes,
      bookingType: "MEMBER",
      matchType,
      hasBallMachine,
      hasLighting,
      notes: notes.trim() || undefined,
      participants: participants.map((p) => ({
        type: p.type,
        userId: p.userId,
        guestName: p.type === "GUEST" ? p.name : undefined,
        guestEmail: p.email,
      })),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              🎾 Platz reservieren
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mandantenfähiges Buchungssystem mit dynamischer Dauer & Fairplay-Regeln
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
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {totalCost > walletBalance && (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleQuickTopUp}
                    disabled={topUpLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3 rounded-xl gap-1.5"
                  >
                    {topUpLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Coins className="w-3 h-3" />
                    )}
                    Jetzt +50 CHF Test-Credits aufladen
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Slot Highlight Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-500/30 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                {currentCourt?.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                {getSurfaceLabel(currentCourt?.surface)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {currentCourt?.sportType === "PADEL" ? "Padel" : "Tennis"}
              </span>
              {currentCourt?.isIndoor ? (
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">
                  Halle (Indoor)
                </span>
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
              <Label htmlFor="court" className="text-xs">Tennisplatz / Court</Label>
              <select
                id="court"
                value={courtId}
                onChange={(e) => setCourtId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-xs focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.sportType === "PADEL" ? "Padel" : getSurfaceLabel(c.surface)})
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
          {/* Match Type */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Spielart & Teilnehmer-Modus
              </Label>
              <span className="text-[11px] text-slate-500">
                {matchType === "SINGLE" ? "2 Spieler benötigt (1 Partner)" : "4 Spieler benötigt (3 Partner)"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMatchTypeChange("SINGLE")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  matchType === "SINGLE"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Einzel Match (1 vs 1)
              </button>
              <button
                type="button"
                onClick={() => handleMatchTypeChange("DOUBLE")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  matchType === "DOUBLE"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Doppel Match (2 vs 2)
              </button>
            </div>
          </div>

          {/* E.3 Duration Selector: 60, 90, or 120 (Consecutive 2h for Doubles) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Spieldauer
              </Label>
              {matchType === "DOUBLE" && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Doppel: 2h am Stück freigeschaltet!
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDurationMinutes(60)}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                  durationMinutes === 60
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                60 Min (1h)
              </button>

              <button
                type="button"
                onClick={() => setDurationMinutes(90)}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                  durationMinutes === 90
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                90 Min (1.5h)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (matchType === "DOUBLE") {
                    setDurationMinutes(120);
                  }
                }}
                disabled={matchType !== "DOUBLE"}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all text-center ${
                  matchType !== "DOUBLE"
                    ? "opacity-40 border-dashed border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-slate-800 dark:bg-slate-800/40"
                    : durationMinutes === 120
                    ? "border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 shadow-xs font-bold ring-1 ring-amber-500/30"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                }`}
                title={matchType !== "DOUBLE" ? "2 Stunden am Stück sind nur im 4er-Doppel erlaubt" : ""}
              >
                120 Min (2h) 🎾
              </button>
            </div>
            {matchType !== "DOUBLE" && (
              <p className="text-[10px] text-slate-400 mt-1">
                * Anti-Blockier-Regel: 2 aufeinanderfolgende Stunden sind nur im 4er-Doppel gestattet.
              </p>
            )}
          </div>

          {/* E.2 Deluxe Mitspieler- & Favoriten-Auswahl */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                Mitspieler & Spielpartner ({participants.length}/{requiredPartnersCount})
              </Label>
              <Badge
                variant={isSquadFull ? "default" : "secondary"}
                className={isSquadFull ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}
              >
                {isSquadFull ? "Team vollständig" : `Noch ${requiredPartnersCount - participants.length} nötig`}
              </Badge>
            </div>

            {/* Selected Partners Pills */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
              {participants.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Noch keine Partner ausgewählt</span>
              ) : (
                participants.map((p) => (
                  <div
                    key={p.id}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {p.name}
                    </span>
                    {p.type === "GUEST" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                        Gast (+{guestFeePerPerson} CHF)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
                      className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Buddy Favorites Bar */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Häufige Spielpartner (Buddies):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {buddyMembers.map((buddy) => {
                  const isSelected = participants.some((p) => p.userId === buddy.id);
                  return (
                    <button
                      key={buddy.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setParticipants(participants.filter((p) => p.userId !== buddy.id));
                        } else {
                          addMemberParticipant(buddy);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500"
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold flex items-center justify-center text-slate-700 dark:text-slate-300">
                        {buddy.firstName[0]}
                        {buddy.lastName[0]}
                      </span>
                      <span>{buddy.firstName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Search & Guest Adding Controls */}
            {!isSquadFull && (
              <div className="pt-2 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Clubmitglied suchen..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8 rounded-xl bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Filtered Member list (Quick click) */}
                {memberSearchQuery && (
                  <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
                    {filteredMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 text-center">Kein Mitglied gefunden</p>
                    ) : (
                      filteredMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            addMemberParticipant(m);
                            setMemberSearchQuery("");
                          }}
                          className="w-full text-left p-1.5 text-xs hover:bg-emerald-50 dark:hover:bg-slate-700/60 rounded-lg flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {m.firstName} {m.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400">{m.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Add Guest Player Collapsible */}
                {!showAddGuest ? (
                  <button
                    type="button"
                    onClick={() => setShowAddGuest(true)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Gastspieler erfassen (+{guestFeePerPerson} CHF)
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-2 animate-in fade-in">
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block">
                      Gastspieler hinzufügen (+{guestFeePerPerson} CHF Gastgebühr)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        type="text"
                        placeholder="Name (z.B. Martina Hingis)"
                        value={newGuestName}
                        onChange={(e) => setNewGuestName(e.target.value)}
                        className="text-xs h-8 bg-white dark:bg-slate-800"
                      />
                      <Input
                        type="email"
                        placeholder="E-Mail (optional)"
                        value={newGuestEmail}
                        onChange={(e) => setNewGuestEmail(e.target.value)}
                        className="text-xs h-8 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddGuest(false)}
                        className="text-xs h-7"
                      >
                        Abbrechen
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddGuest}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 rounded-lg"
                      >
                        Gast übernehmen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* E.5 Zusatzleistungen (Equipment: Ballmaschine & Flutlicht) */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <Label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Zusatzleistungen & Equipment
            </Label>

            <div className="space-y-2">
              {/* Ballmaschine with Exclusivity Protection */}
              <div
                className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  ballMachineConflict
                    ? "bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 opacity-60"
                    : hasBallMachine
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      🎾 Ballmaschine reservieren
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      +{(tenant.settingsJson?.ballMachineFee ?? 10) * durationHours} CHF
                    </span>
                  </div>
                  {ballMachineConflict ? (
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                      ⚠️ Zu dieser Zeit bereits auf {ballMachineConflict} reserviert (Exklusiv-Ressource).
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500">
                      Automatische Ballausgabe für intensives Einzeltraining.
                    </p>
                  )}
                </div>

                <input
                  type="checkbox"
                  disabled={Boolean(ballMachineConflict)}
                  checked={hasBallMachine && !ballMachineConflict}
                  onChange={(e) => setHasBallMachine(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                />
              </div>

              {/* Floodlight */}
              <div
                className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  hasLighting
                    ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      💡 Flutlicht aktivieren
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      +{tenant.settingsJson?.floodlightFee ?? 5} CHF
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Für Abendslots oder schlechte Lichtverhältnisse.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={hasLighting}
                  onChange={(e) => setHasLighting(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Bemerkungen (optional)
            </Label>
            <Input
              id="notes"
              type="text"
              placeholder="z.B. Ranglistenspiel, Matchpraxis"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 text-xs rounded-xl"
            />
          </div>

          {/* E.1 Transparent Price & Credits Wallet Summary Box */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white space-y-2.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Kostenübersicht & Credit-Guthaben
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400">
                  Guthaben: {walletBalance.toFixed(2)} CHF
                </span>
                <button
                  type="button"
                  onClick={handleQuickTopUp}
                  disabled={topUpLoading}
                  className="text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  title="1-Klick Dev/Test: +50 CHF aufladen"
                >
                  {topUpLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "+50 CHF"}
                </button>
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Platzgebühr ({durationMinutes} Min):</span>
                <span className="font-mono">{courtRate > 0 ? `${courtRate.toFixed(2)} CHF` : "0.00 CHF (Inklusive)"}</span>
              </div>
              {guestCount > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span>Gastgebühr ({guestCount}x Gast):</span>
                  <span className="font-mono">+{totalGuestFee.toFixed(2)} CHF</span>
                </div>
              )}
              {hasBallMachine && (
                <div className="flex justify-between text-emerald-300">
                  <span>Ballmaschine:</span>
                  <span className="font-mono">+{ballMachineCost.toFixed(2)} CHF</span>
                </div>
              )}
              {hasLighting && (
                <div className="flex justify-between text-amber-300">
                  <span>Flutlicht:</span>
                  <span className="font-mono">+{lightingCost.toFixed(2)} CHF</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Gesamtbetrag:</span>
              <span className="text-base font-extrabold font-mono text-emerald-400">
                {totalCost.toFixed(2)} CHF
              </span>
            </div>

            {totalCost > 0 && (
              <p className="text-[10px] text-slate-400">
                {walletBalance >= totalCost
                  ? `✓ Wird automatisch vom Guthaben abgebucht (Rest nach Buchung: ${(walletBalance - totalCost).toFixed(2)} CHF).`
                  : `⚠️ Guthaben reicht nicht aus. Bitte klicke oben auf '+50 CHF', um dein Test-Guthaben aufzuladen.`}
              </p>
            )}
          </div>

          {/* Rules hint */}
          <div className="rounded-2xl bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-start gap-2.5 border border-emerald-100 dark:border-emerald-900/50">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-bold">Club-Buchungsregeln (Fairplay & Marly-Modell):</p>
              <p className="mt-0.5 opacity-90 text-[11px]">
                Kostenlose Stornierung bis {tenant.settingsJson?.cancellationDeadlineHours ?? 24} Stunden vor Spielbeginn mit automatischer Credit-Rückerstattung. Max. {tenant.settingsJson?.maxActiveSlotsPerPlayer ?? 2} aktive Buchungen gleichzeitig (Rolling Release nach Slot-Ablauf).
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
              className="rounded-xl text-xs cursor-pointer"
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={loading || Boolean(totalCost > 0 && currentUserId && walletBalance < totalCost)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-2 shadow-xs shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {totalCost > 0 ? `Verbindlich buchen (${totalCost.toFixed(2)} CHF)` : "Reservierung verbindlich buchen"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
