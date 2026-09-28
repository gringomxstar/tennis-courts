"use client";

import { useState } from "react";
import { MembershipPlan } from "@/types";
import {
  createMembershipPlanAction,
  deleteMembershipPlanAction,
} from "@/app/actions/club-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  CreditCard,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface MembershipPlansManagerProps {
  clubSlug: string;
  initialPlans: MembershipPlan[];
}

export function MembershipPlansManager({
  clubSlug,
  initialPlans,
}: MembershipPlansManagerProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>(initialPlans);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(300);
  const [currency, setCurrency] = useState("CHF");
  const [bookingWindowDays, setBookingWindowDays] = useState<number>(7);
  const [simultaneousBookingLimit, setSimultaneousBookingLimit] = useState<number>(3);
  const [dailyBookingLimit, setDailyBookingLimit] = useState<number>(1);
  const [allow60, setAllow60] = useState(true);
  const [allow90, setAllow90] = useState(true);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setFeedback(null);

    const allowedDurations: number[] = [];
    if (allow60) allowedDurations.push(60);
    if (allow90) allowedDurations.push(90);
    if (allowedDurations.length === 0) allowedDurations.push(60);

    try {
      const res = await createMembershipPlanAction(clubSlug, {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        currency,
        bookingWindowDays: Number(bookingWindowDays),
        simultaneousBookingLimit: Number(simultaneousBookingLimit),
        dailyBookingLimit: Number(dailyBookingLimit),
        weeklyBookingLimit: Number(simultaneousBookingLimit) * 2,
        allowedDurations,
      });

      if (res.success && res.plan) {
        setPlans([...plans, res.plan]);
        setShowAddForm(false);
        setName("");
        setDescription("");
        setFeedback({
          type: "success",
          message: `Tarif "${res.plan.name}" erfolgreich hinzugefügt!`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Fehler beim Erstellen des Tarifs.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Ein Fehler ist aufgetreten.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Möchtest du den Tarif "${planName}" wirklich entfernen?`)) {
      return;
    }

    setDeletingId(planId);
    setFeedback(null);

    try {
      const res = await deleteMembershipPlanAction(clubSlug, planId);
      if (res.success) {
        setPlans(plans.filter((p) => p.id !== planId));
        setFeedback({
          type: "success",
          message: `Tarif "${planName}" erfolgreich archiviert.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Fehler beim Löschen des Tarifs.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Ein Fehler ist aufgetreten.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Mitgliedschaftstarife & Quoten ({plans.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Konfiguration von Saisongebühren, Buchungsfenstern und Quoten.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant={showAddForm ? "secondary" : "outline"}
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs gap-1.5 h-8"
        >
          <Plus className="w-3.5 h-3.5" />
          {showAddForm ? "Abbrechen" : "Neuer Tarif"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Create Plan Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreatePlan}
            className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/60 space-y-3 mb-4"
          >
            <h4 className="font-semibold text-xs text-slate-900 dark:text-white">
              Neuen Mitgliedschaftstarif erstellen
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="planName" className="text-xs">
                  Tarifname *
                </Label>
                <Input
                  id="planName"
                  placeholder="z. B. Student / Senioren"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="price" className="text-xs">
                    Preis *
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    className="text-xs bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="currency" className="text-xs">
                    Währung
                  </Label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="planDesc" className="text-xs">
                Beschreibung
              </Label>
              <Input
                id="planDesc"
                placeholder="z. B. Ermässigter Spielbeitrag für Studenten mit Ausweis"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs bg-white dark:bg-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bookingWindowDays" className="text-xs">
                  Buchungsvorlauf (Tage)
                </Label>
                <Input
                  id="bookingWindowDays"
                  type="number"
                  min={1}
                  max={30}
                  value={bookingWindowDays}
                  onChange={(e) => setBookingWindowDays(Number(e.target.value))}
                  className="text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="simultaneousBookingLimit" className="text-xs">
                  Max. aktive Buchungen
                </Label>
                <Input
                  id="simultaneousBookingLimit"
                  type="number"
                  min={1}
                  max={10}
                  value={simultaneousBookingLimit}
                  onChange={(e) =>
                    setSimultaneousBookingLimit(Number(e.target.value))
                  }
                  className="text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="dailyBookingLimit" className="text-xs">
                  Max. Buchungen / Tag
                </Label>
                <Input
                  id="dailyBookingLimit"
                  type="number"
                  min={1}
                  max={5}
                  value={dailyBookingLimit}
                  onChange={(e) => setDailyBookingLimit(Number(e.target.value))}
                  className="text-xs bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-xs block mb-1.5 font-medium">
                Erlaubte Spieldauern
              </Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allow60}
                    onChange={(e) => setAllow60(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 w-3.5 h-3.5"
                  />
                  60 Minuten
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allow90}
                    onChange={(e) => setAllow90(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 w-3.5 h-3.5"
                  />
                  90 Minuten
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="text-xs h-8"
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Tarif speichern
              </Button>
            </div>
          </form>
        )}

        {/* Existing Plans List */}
        <div className="space-y-3">
          {plans.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Keine Tarife angelegt. Klicke auf &quot;Neuer Tarif&quot;, um einen Tarif zu definieren.
            </p>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      {plan.name}
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none font-bold text-xs">
                      {plan.price} {plan.currency}
                    </Badge>
                  </div>
                  {plan.description && (
                    <p className="text-xs text-slate-500">{plan.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Vorlauf: {plan.bookingWindowDays} Tage
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      Max. aktiv: {plan.simultaneousBookingLimit}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Dauern: {plan.allowedDurations.join(", ")} Min.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deletingId === plan.id}
                    onClick={() => handleDeletePlan(plan.id, plan.name)}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-xs h-8 px-2.5"
                  >
                    {deletingId === plan.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
