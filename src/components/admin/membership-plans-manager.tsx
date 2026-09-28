"use client";

import { useState } from "react";
import { MembershipPlan } from "@/types";
import {
  createMembershipPlanAction,
  deleteMembershipPlanAction,
} from "@/app/actions/club-settings";
import { SwitchKnob } from "@/components/app/switch";
import { Spinner } from "@/components/app/avatar";

const label = "block truncate text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-card px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-clay";
const secondary = "shrink-0 rounded-[12px] bg-inset px-3.5 py-2 text-[14px] font-bold text-clay-text disabled:opacity-60";

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
  const [armedId, setArmedId] = useState<string | null>(null);
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
  const [guestsPerWeek, setGuestsPerWeek] = useState("");
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
        guestsPerWeek: guestsPerWeek === "" ? null : Number(guestsPerWeek),
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

  // Two-tap confirm (same pattern as "Stornieren"): first tap arms, second deletes.
  const handleDeletePlan = async (planId: string, planName: string) => {
    if (armedId !== planId) {
      setArmedId(planId);
      setTimeout(() => setArmedId((id) => (id === planId ? null : id)), 3000);
      return;
    }
    setArmedId(null);

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
    <section className="rounded-[26px] border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-.02em]">Tarife ({plans.length})</h2>
          <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">
            Saisongebühren, Buchungsfenster und Quoten.
          </p>
        </div>
        <button type="button" aria-expanded={showAddForm} onClick={() => setShowAddForm(!showAddForm)} className={secondary}>
          {showAddForm ? "Abbrechen" : "Neuer Tarif"}
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {feedback && (
          <div
            role="status"
            className={`rounded-[18px] px-4 py-3 text-[15px] font-semibold ${
              feedback.type === "success" ? "bg-paid-bg text-paid-fg" : "bg-clay text-white"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleCreatePlan} className="flex flex-col gap-4 rounded-[20px] bg-inset p-4">
            <h3 className="text-[17px] font-bold tracking-[-.01em]">Neuer Tarif</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className={label}>Tarifname *</span>
                <input
                  id="planName"
                  placeholder="z. B. Student / Senioren"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={input}
                />
              </label>
              <div className="grid grid-cols-2 gap-3 sm:w-[240px]">
                <label className="block">
                  <span className={label}>Preis *</span>
                  <input
                    id="price"
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    className={input}
                  />
                </label>
                <label className="block">
                  <span className={label}>Währung</span>
                  <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={input}>
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>
            </div>

            <label className="block">
              <span className={label}>Beschreibung</span>
              <input
                id="planDesc"
                placeholder="z. B. Ermässigter Spielbeitrag für Studenten mit Ausweis"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={input}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block">
                <span className={label}>Vorlauf</span>
                <input
                  id="bookingWindowDays"
                  type="number"
                  min={1}
                  max={30}
                  value={bookingWindowDays}
                  onChange={(e) => setBookingWindowDays(Number(e.target.value))}
                  className={input}
                />
              </label>
              <label className="block">
                <span className={label}>Max. aktiv</span>
                <input
                  id="simultaneousBookingLimit"
                  type="number"
                  min={1}
                  max={10}
                  value={simultaneousBookingLimit}
                  onChange={(e) => setSimultaneousBookingLimit(Number(e.target.value))}
                  className={input}
                />
              </label>
              <label className="block">
                <span className={label}>Pro Tag</span>
                <input
                  id="dailyBookingLimit"
                  type="number"
                  min={1}
                  max={5}
                  value={dailyBookingLimit}
                  onChange={(e) => setDailyBookingLimit(Number(e.target.value))}
                  className={input}
                />
              </label>
              <label className="block">
                <span className={label}>Gäste/Woche</span>
                <input
                  id="guestsPerWeek"
                  type="number"
                  min={0}
                  max={20}
                  placeholder="∞"
                  value={guestsPerWeek}
                  onChange={(e) => setGuestsPerWeek(e.target.value)}
                  className={input}
                />
              </label>
            </div>

            <div>
              <div className={label}>Erlaubte Spieldauern</div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(
                  [
                    ["60 Min.", allow60, setAllow60],
                    ["90 Min.", allow90, setAllow90],
                  ] as const
                ).map(([text, on, set]) => (
                  <button
                    key={text}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set(!on)}
                    className="flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3 text-left"
                  >
                    <span className="flex-1 text-[16px] font-semibold">{text}</span>
                    <SwitchKnob on={on} />
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-clay text-[17px] font-bold text-white active:scale-[.97] disabled:opacity-70"
            >
              {loading && <Spinner />}
              Tarif speichern
            </button>
          </form>
        )}

        {plans.length === 0 ? (
          <p className="rounded-[20px] bg-inset px-4 py-5 text-center text-[15px] text-muted-foreground">
            Keine Tarife angelegt. Tippe auf &quot;Neuer Tarif&quot;, um einen Tarif zu definieren.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[22px] border border-border">
            {plans.map((plan) => (
              <div key={plan.id} className="flex items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-bold">{plan.name}</span>
                    <span className="rounded-full bg-paid-bg px-3 py-1 text-[13px] font-bold text-paid-fg">
                      {plan.price} {plan.currency}
                    </span>
                  </div>
                  {plan.description && <p className="mt-0.5 text-[14px] text-muted-foreground">{plan.description}</p>}
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Vorlauf {plan.bookingWindowDays} Tage · Max. aktiv {plan.simultaneousBookingLimit} · {plan.dailyBookingLimit}/Tag · {plan.allowedDurations.join("/")} Min.
                    {plan.guestsPerWeek != null ? ` · ${plan.guestsPerWeek} Gäste/Woche` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deletingId === plan.id}
                  onClick={() => handleDeletePlan(plan.id, plan.name)}
                  aria-label={`Tarif ${plan.name} entfernen`}
                  className={secondary}
                >
                  {deletingId === plan.id ? "…" : armedId === plan.id ? "Wirklich entfernen?" : "Entfernen"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
