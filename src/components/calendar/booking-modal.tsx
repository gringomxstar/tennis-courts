"use client";

import { useState, useMemo } from "react";
import { Court, UserSummary, Tenant } from "@/types";
import { createBookingAction, topUpWalletAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  AlertCircle,
  Loader2,
  Coins,
  Search,
  UserPlus,
  Check
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

const getMockRanking = (id: string) => {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `R${(hash % 9) + 1}`;
};

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

  const [walletBalance, setWalletBalance] = useState(userWallet?.balance ?? 50);
  const [topUpLoading, setTopUpLoading] = useState(false);

  const [hasBallMachine, setHasBallMachine] = useState(false);
  const [hasLighting, setHasLighting] = useState(false);

  const currentUser = members.find((m) => m.id === currentUserId) || {
    id: currentUserId || "du",
    firstName: "Roger",
    lastName: "Federer",
    email: "roger@example.com",
    role: "MEMBER",
  };

  const defaultOpponent = members.find((m) => m.id !== currentUserId);
  const [participants, setParticipants] = useState<ParticipantSlot[]>([]);

  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALLE" | "FAV" | "GAST">("ALLE");
  
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const [startHour, startMin] = time.split(":").map(Number);
  const endTotalMinutes = (startHour || 0) * 60 + (startMin || 0) + durationMinutes;
  const endHour = Math.floor(endTotalMinutes / 60) % 24;
  const endMinute = endTotalMinutes % 60;
  const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

  const durationHours = durationMinutes / 60;
  let courtRate = 0;
  if (currentCourt?.sportType === "PADEL") {
    courtRate = (tenant.settingsJson?.defaultHourlyRatePadel ?? currentCourt.hourlyRate ?? 40) * durationHours;
  } else if (currentCourt?.isIndoor) {
    courtRate = (tenant.settingsJson?.defaultHourlyRateHalle ?? currentCourt.hourlyRate ?? 45) * durationHours;
  } else {
    courtRate = currentUserId ? 0 : (tenant.settingsJson?.defaultHourlyRateTennis ?? 30) * durationHours;
  }

  const guestCount = participants.filter((p) => p.type === "GUEST").length;
  const guestFeePerPerson = tenant.settingsJson?.guestFee ?? 15;
  const totalGuestFee = guestCount * guestFeePerPerson;
  const ballMachineCost = hasBallMachine ? (tenant.settingsJson?.ballMachineFee ?? 10) * durationHours : 0;
  const lightingCost = hasLighting ? (tenant.settingsJson?.floodlightFee ?? 5) : 0;
  const totalCost = courtRate + totalGuestFee + ballMachineCost + lightingCost;

  const handleQuickTopUp = async () => {
    setTopUpLoading(true);
    const res = await topUpWalletAction({ clubSlug: tenant.slug, amount: 50 });
    setTopUpLoading(false);
    if (res.success && res.balance !== undefined) {
      setWalletBalance(res.balance);
      setError(null);
    }
  };

  const addParticipant = (p: ParticipantSlot) => {
    if (participants.some((existing) => existing.id === p.id)) return;
    if (participants.length >= requiredPartnersCount) {
      if (matchType === "SINGLE") {
        setParticipants([p]);
      }
      return;
    }
    setParticipants([...participants, p]);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) return;
    addParticipant({
      id: `guest-${Date.now()}`,
      type: "GUEST",
      name: newGuestName.trim(),
      email: newGuestEmail.trim() || undefined,
    });
    setNewGuestName("");
    setNewGuestEmail("");
  };

  const handleMatchTypeChange = (newType: "SINGLE" | "DOUBLE") => {
    setMatchType(newType);
    if (newType === "SINGLE") {
      if (durationMinutes === 120) setDurationMinutes(60);
      if (participants.length > 1) {
        setParticipants(participants.slice(0, 1));
      }
    }
  };

  const buddyMembers = members.filter((m) => m.id !== currentUserId).slice(0, 8);
  const filteredMembers = members.filter((m) => {
    if (m.id === currentUserId) return false;
    if (!memberSearchQuery) return true;
    const query = memberSearchQuery.toLowerCase();
    const rank = getMockRanking(m.id).toLowerCase();
    return (
      m.firstName.toLowerCase().includes(query) ||
      m.lastName.toLowerCase().includes(query) ||
      rank.includes(query)
    );
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    if (participants.length < requiredPartnersCount) {
      setLoading(false);
      setError(
        matchType === "SINGLE"
          ? "Bitte wähle einen Spielpartner für das Einzel aus."
          : `Für ein Doppel müssen 3 Mitspieler ausgewählt werden (aktuell: ${participants.length}).`
      );
      return;
    }

    if (totalCost > 0 && currentUserId && walletBalance < totalCost) {
      setLoading(false);
      setError(
        `Nicht genügend Guthaben (${walletBalance.toFixed(2)} CHF vorhanden, ${totalCost.toFixed(2)} CHF benötigt).`
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

  const renderPlayerSlot = (index: number) => {
    const p = participants[index];
    if (!p) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <UserPlus className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">Spieler {index + 2} auswählen...</span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
            {p.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {p.name}
              {p.type === "GUEST" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">Gast</span>
              )}
            </div>
            {p.type === "MEMBER" && p.userId && (
              <span className="text-xs text-slate-500 font-medium">{getMockRanking(p.userId)}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => removeParticipant(p.id)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[95vh] overflow-hidden rounded-3xl bg-slate-50 dark:bg-[#0B1120] shadow-2xl border border-slate-200 dark:border-white/[0.08] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 bg-white dark:bg-[#141A26] border-b border-slate-100 dark:border-white/[0.05] shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              🎾 Spacious Reservation Studio
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Platzreservierung für {currentCourt?.name} am {selectedDateStr}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2.5 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: Two Columns */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Left Column: Match Setup & Billing */}
          <div className="w-full md:w-[45%] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141A26] overflow-y-auto">
            <div className="p-6 flex-1 space-y-6">
              
              {error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-200 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold">{error}</span>
                    {totalCost > walletBalance && (
                      <Button
                        type="button"
                        onClick={handleQuickTopUp}
                        disabled={topUpLoading}
                        className="mt-3 bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 px-4 rounded-xl w-full"
                      >
                        {topUpLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Coins className="w-3 h-3 mr-2" />}
                        Jetzt +50 CHF aufladen
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Match Type */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Spielmodus</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleMatchTypeChange("SINGLE")}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                      matchType === "SINGLE"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-500"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                    }`}
                  >
                    🎾 Einzel (2)
                  </button>
                  <button
                    onClick={() => handleMatchTypeChange("DOUBLE")}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                      matchType === "DOUBLE"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-500"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                    }`}
                  >
                    👥 Doppel (4)
                  </button>
                </div>
              </div>

              {/* Time & Duration */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Startzeit & Dauer</Label>
                <div className="flex gap-3">
                  <Input
                    type="time"
                    step="1800"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-32 h-11 text-lg font-bold bg-slate-50 dark:bg-slate-800"
                  />
                  <div className="flex flex-1 items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl px-4 text-slate-500 font-mono text-sm">
                    bis {endTime} Uhr
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[60, 90, 120].map((mins) => {
                    const isDisabled = mins === 120 && matchType !== "DOUBLE";
                    const isSelected = durationMinutes === mins;
                    return (
                      <button
                        key={mins}
                        onClick={() => !isDisabled && setDurationMinutes(mins)}
                        disabled={isDisabled}
                        className={`py-2 rounded-lg text-sm font-bold transition-all ${
                          isDisabled
                            ? "opacity-40 bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800"
                            : isSelected
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {mins} Min
                      </button>
                    )
                  })}
                </div>
                {matchType !== "DOUBLE" && (
                  <p className="text-xs text-slate-500 mt-1">120 Min. nur bei 4er-Doppel aktivierbar.</p>
                )}
              </div>

              {/* Extras */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Zusatzoptionen</Label>
                <div className="space-y-2">
                  <label className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    hasBallMachine && !ballMachineConflict ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasBallMachine ? "bg-emerald-200 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                        🎾
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">Ballmaschine</div>
                        <div className="text-xs text-slate-500">
                          {ballMachineConflict ? `Belegt auf ${ballMachineConflict}` : "+10.- CHF"}
                        </div>
                      </div>
                    </div>
                    <input type="checkbox" disabled={Boolean(ballMachineConflict)} checked={hasBallMachine && !ballMachineConflict} onChange={(e) => setHasBallMachine(e.target.checked)} className="w-5 h-5 rounded text-emerald-600" />
                  </label>

                  <label className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    hasLighting ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasLighting ? "bg-amber-200 text-amber-700" : "bg-slate-200 text-slate-500"}`}>
                        💡
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">Flutlicht</div>
                        <div className="text-xs text-slate-500">+5.- CHF</div>
                      </div>
                    </div>
                    <input type="checkbox" checked={hasLighting} onChange={(e) => setHasLighting(e.target.checked)} className="w-5 h-5 rounded text-amber-600" />
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Notizen</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Spielankündigung..." className="bg-slate-50 dark:bg-slate-800" />
              </div>
            </div>

            {/* Price Footer */}
            <div className="p-6 bg-slate-50 dark:bg-[#0B1120] border-t border-slate-200 dark:border-slate-800 mt-auto">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Platzmiete (Mitglied)</span>
                  <span>{courtRate.toFixed(2)} CHF</span>
                </div>
                {guestCount > 0 && (
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Gastspieler ({guestCount}x)</span>
                    <span>{totalGuestFee.toFixed(2)} CHF</span>
                  </div>
                )}
                {hasBallMachine && (
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Ballmaschine</span>
                    <span>{ballMachineCost.toFixed(2)} CHF</span>
                  </div>
                )}
                {hasLighting && (
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Flutlicht</span>
                    <span>{lightingCost.toFixed(2)} CHF</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Total</span>
                  <span>{totalCost.toFixed(2)} CHF</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Wallet Guthaben</span>
                  <span className={walletBalance < totalCost ? "text-rose-500 font-bold" : ""}>{walletBalance.toFixed(2)} CHF</span>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-12 text-base font-bold bg-[#E25B36] hover:bg-[#C84B2B] text-white shadow-lg rounded-xl"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                Platz jetzt verbindlich buchen
              </Button>
            </div>
          </div>

          {/* Right Column: Participants Directory */}
          <div className="w-full md:w-[55%] flex flex-col p-6 overflow-y-auto">
            {/* Player Slots */}
            <div className="mb-6">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Spieler Slots</h3>
              <div className="space-y-3">
                {/* Slot 1: Current User */}
                <div className="flex items-center p-3 rounded-xl border-2 border-slate-800 dark:border-slate-600 bg-slate-900 dark:bg-slate-800 text-white shadow-md">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold mr-3">
                    {currentUser.firstName[0]}{currentUser.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold flex items-center gap-2">
                      {currentUser.firstName} {currentUser.lastName} (Du)
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500 text-white">Veranstalter</span>
                    </div>
                  </div>
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>

                {/* Slot 2, 3, 4 */}
                {renderPlayerSlot(0)}
                {matchType === "DOUBLE" && (
                  <>
                    {renderPlayerSlot(1)}
                    {renderPlayerSlot(2)}
                  </>
                )}
              </div>
            </div>

            {/* Directory Section */}
            <div className="flex-1 flex flex-col min-h-[400px]">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Club-Verzeichnis</h3>
              
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Suche Name oder Ranking (z.B. R2)..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="pl-10 h-11 text-base bg-white dark:bg-slate-800 rounded-xl"
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab("ALLE")}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "ALLE" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}
                >
                  👥 Alle Mitglieder
                </button>
                <button
                  onClick={() => setActiveTab("FAV")}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "FAV" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}
                >
                  ⭐ Favoriten
                </button>
                <button
                  onClick={() => setActiveTab("GAST")}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "GAST" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}
                >
                  👤 + Gast
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-2">
                {activeTab === "ALLE" && (
                  filteredMembers.map((m) => {
                    const rank = getMockRanking(m.id);
                    const isSelected = participants.some((p) => p.userId === m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-sm">
                            {m.firstName[0]}{m.lastName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{m.firstName} {m.lastName}</div>
                            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30 px-1.5 rounded inline-block mt-0.5">
                              {rank}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "outline" : "default"}
                          disabled={isSelected}
                          onClick={() => addParticipant({ id: `part-${m.id}`, type: "MEMBER", userId: m.id, name: `${m.firstName} ${m.lastName}`, email: m.email })}
                          className={`rounded-lg text-xs font-bold ${!isSelected && "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600"}`}
                        >
                          {isSelected ? "Ausgewählt" : "+ Wählen"}
                        </Button>
                      </div>
                    )
                  })
                )}

                {activeTab === "FAV" && (
                  buddyMembers.map((m) => {
                    const rank = getMockRanking(m.id);
                    const isSelected = participants.some((p) => p.userId === m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                            ⭐
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{m.firstName} {m.lastName}</div>
                            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30 px-1.5 rounded inline-block mt-0.5">
                              {rank}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "outline" : "default"}
                          disabled={isSelected}
                          onClick={() => addParticipant({ id: `part-${m.id}`, type: "MEMBER", userId: m.id, name: `${m.firstName} ${m.lastName}`, email: m.email })}
                          className={`rounded-lg text-xs font-bold ${!isSelected && "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600"}`}
                        >
                          {isSelected ? "Ausgewählt" : "+ Wählen"}
                        </Button>
                      </div>
                    )
                  })
                )}

                {activeTab === "GAST" && (
                  <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
                    <h4 className="font-bold text-amber-900 dark:text-amber-400 mb-3 text-sm">Externen Gastspieler erfassen (+{guestFeePerPerson} CHF)</h4>
                    <form onSubmit={handleAddGuest} className="space-y-3">
                      <Input
                        placeholder="Vor- und Nachname (z.B. Martina Hingis)"
                        value={newGuestName}
                        onChange={(e) => setNewGuestName(e.target.value)}
                        className="bg-white dark:bg-slate-800"
                        required
                      />
                      <Input
                        type="email"
                        placeholder="E-Mail für Bestätigung (optional)"
                        value={newGuestEmail}
                        onChange={(e) => setNewGuestEmail(e.target.value)}
                        className="bg-white dark:bg-slate-800"
                      />
                      <Button type="submit" className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white">
                        Gast hinzufügen
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
