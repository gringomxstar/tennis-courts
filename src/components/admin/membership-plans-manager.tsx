"use client";

import { useMemo, useRef, useState } from "react";
import { MembershipPlan, SportType } from "@/types";
import { createMembershipPlanAction, deleteMembershipPlanAction, updateMembershipPlanAction } from "@/app/actions/club-settings";
import { playWindowLabel } from "@/lib/booking-rules";
import { SwitchKnob } from "@/components/app/switch";
import { Spinner } from "@/components/app/avatar";

const label = "block truncate text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-card px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-clay";
const secondary = "shrink-0 rounded-[12px] bg-inset px-3.5 py-2 text-[14px] font-bold text-clay-text disabled:opacity-60";
const tag = "rounded-full bg-inset px-2.5 py-0.5 text-[12px] font-bold text-muted-foreground";
const chip = (on: boolean) => `h-9 flex-1 rounded-[10px] text-[13px] font-bold ${on ? "bg-clay text-white" : "bg-card"}`;
const toggleRow = "flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3 text-left";

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const SPORT_LABEL: Record<SportType, string> = {
  TENNIS: "Tennis",
  PADEL: "Padel",
};
const CATEGORIES = ["Kinder", "Junioren", "Junge Erwachsene", "Studierende & Lehrlinge", "Erwachsene", "Senioren", "Abo Soleil", "Rollstuhltennis"];
type SportFilter = "ALL" | "TENNIS" | "PADEL" | "BOTH";

const sportsOf = (p: MembershipPlan): SportType[] => (p.sports?.length ? p.sports : ["TENNIS"]);
/** 0 Tennis, 1 Padel, 2 both — list order and filter key. */
const sportRank = (p: MembershipPlan) => (sportsOf(p).length > 1 ? 2 : sportsOf(p)[0] === "PADEL" ? 1 : 0);
const categoryRank = (c: string | null | undefined) => (c ? CATEGORIES.indexOf(c) + 1 || CATEGORIES.length + 1 : CATEGORIES.length + 2);
const ageLabel = (p: MembershipPlan) =>
  p.ageMin != null && p.ageMax != null
    ? `${p.ageMin}–${p.ageMax} J.`
    : p.ageMin != null
      ? `ab ${p.ageMin} J.`
      : p.ageMax != null
        ? `bis ${p.ageMax} J.`
        : null;
const ageOrNull = (v: string) => (v === "" ? null : Math.round(Number(v)));

interface MembershipPlansManagerProps {
  clubSlug: string;
  initialPlans: MembershipPlan[];
}

export function MembershipPlansManager({ clubSlug, initialPlans }: MembershipPlansManagerProps) {
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
  const [price, setPrice] = useState<number | string>(300);
  const [currency, setCurrency] = useState("CHF");
  const [bookingWindowDays, setBookingWindowDays] = useState<number | string>(7);
  const [simultaneousBookingLimit, setSimultaneousBookingLimit] = useState<number | string>(3);
  const [dailyBookingLimit, setDailyBookingLimit] = useState<number>(1);
  const [guestsPerWeek, setGuestsPerWeek] = useState("");
  const [allow60, setAllow60] = useState(true);
  const [allow90, setAllow90] = useState(true);
  const [sports, setSports] = useState<SportType[]>(["TENNIS"]);
  const [category, setCategory] = useState("");
  const [couple, setCouple] = useState(false);
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [proofRequired, setProofRequired] = useState(false);
  const [windowOn, setWindowOn] = useState(false);
  const [windowDays, setWindowDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [fromHour, setFromHour] = useState<number | string>(8);
  const [toHour, setToHour] = useState<number | string>(16);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<SportFilter>("ALL");
  const formRef = useRef<HTMLFormElement>(null);

  // Opens the form empty (new plan) or prefilled from an existing plan.
  const openForm = (plan?: MembershipPlan) => {
    setEditingId(plan?.id ?? null);
    setName(plan?.name ?? "");
    setDescription(plan?.description ?? "");
    setPrice(plan?.price ?? 300);
    setCurrency(plan?.currency ?? "CHF");
    setBookingWindowDays(plan?.bookingWindowDays ?? 7);
    setSimultaneousBookingLimit(plan?.simultaneousBookingLimit ?? 3);
    setDailyBookingLimit(plan?.dailyBookingLimit ?? 1);
    setGuestsPerWeek(plan?.guestsPerWeek != null ? String(plan.guestsPerWeek) : "");
    setAllow60(plan ? plan.allowedDurations.includes(60) : true);
    setAllow90(plan ? plan.allowedDurations.includes(90) : true);
    setSports(plan ? sportsOf(plan) : ["TENNIS"]);
    setCategory(plan?.category ?? "");
    setCouple(plan?.persons === 2);
    setAgeMin(plan?.ageMin != null ? String(plan.ageMin) : "");
    setAgeMax(plan?.ageMax != null ? String(plan.ageMax) : "");
    setProofRequired(Boolean(plan?.proofRequired));
    setWindowOn(Boolean(plan?.playWindow));
    setWindowDays(plan?.playWindow?.weekdays ?? [1, 2, 3, 4, 5]);
    setFromHour(plan?.playWindow?.fromHour ?? 8);
    setToHour(plan?.playWindow?.toHour ?? 16);
    setFeedback(null);
    setShowAddForm(true);
    // the list can be long; bring the form into view when editing from further down
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const visiblePlans = useMemo(
    () =>
      plans
        .filter((p) => sportFilter === "ALL" || sportRank(p) === { TENNIS: 0, PADEL: 1, BOTH: 2 }[sportFilter])
        .sort(
          (a, b) =>
            categoryRank(a.category) - categoryRank(b.category) ||
            (a.category ?? "").localeCompare(b.category ?? "") ||
            sportRank(a) - sportRank(b) ||
            (a.persons ?? 1) - (b.persons ?? 1) ||
            a.name.localeCompare(b.name),
        ),
    [plans, sportFilter],
  );
  // consecutive runs of the sorted list share a category heading
  const groups: [string | null, MembershipPlan[]][] = [];
  for (const p of visiblePlans) {
    const last = groups[groups.length - 1];
    if (last && last[0] === (p.category ?? null)) last[1].push(p);
    else groups.push([p.category ?? null, [p]]);
  }

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setFeedback(null);

    const allowedDurations: number[] = [];
    if (allow60) allowedDurations.push(60);
    if (allow90) allowedDurations.push(90);
    if (allowedDurations.length === 0) allowedDurations.push(60);

    const fields = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number(price),
      currency,
      bookingWindowDays: Number(bookingWindowDays),
      simultaneousBookingLimit: Number(simultaneousBookingLimit),
      dailyBookingLimit: Number(dailyBookingLimit),
      allowedDurations,
      guestsPerWeek: guestsPerWeek === "" ? null : Number(guestsPerWeek),
      sports,
      category: category.trim() || null,
      persons: (couple ? 2 : 1) as 1 | 2,
      ageMin: ageOrNull(ageMin),
      ageMax: ageOrNull(ageMax),
      proofRequired,
      playWindow: windowOn
        ? {
            weekdays: windowDays,
            fromHour: Number(fromHour),
            toHour: Number(toHour),
          }
        : null,
    };

    try {
      // Edit keeps the stored weekly limit; a new plan derives it as before.
      const res = editingId
        ? await updateMembershipPlanAction(clubSlug, editingId, fields)
        : await createMembershipPlanAction(clubSlug, {
            ...fields,
            weeklyBookingLimit: fields.simultaneousBookingLimit * 2,
          });

      if (res.success && res.plan) {
        const saved = res.plan;
        setPlans(editingId ? plans.map((p) => (p.id === editingId ? saved : p)) : [...plans, saved]);
        setShowAddForm(false);
        setEditingId(null);
        setFeedback({
          type: "success",
          message: editingId ? `Tarif "${saved.name}" gespeichert.` : `Tarif "${saved.name}" erfolgreich hinzugefügt!`,
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
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-.02em]">Tarife ({plans.length})</h2>
          <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">Saisongebühren, Buchungsfenster und Quoten.</p>
        </div>
        <button type="button" aria-expanded={showAddForm} onClick={() => (showAddForm ? setShowAddForm(false) : openForm())} className={secondary}>
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
          <form ref={formRef} onSubmit={handleCreatePlan} className="flex flex-col gap-4 rounded-[20px] bg-inset p-4">
            <h3 className="text-[17px] font-bold tracking-[-.01em]">{editingId ? "Tarif bearbeiten" : "Neuer Tarif"}</h3>

            <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-[1fr_auto]">
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
              <div className="grid grid-cols-2 gap-3 @min-[640px]:w-[240px]">
                <label className="block">
                  <span className={label}>Preis *</span>
                  <input
                    id="price"
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
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

            <div className="grid grid-cols-2 gap-3 @min-[640px]:grid-cols-4">
              <label className="block">
                <span className={label}>Vorlauf</span>
                <input
                  id="bookingWindowDays"
                  type="number"
                  min={1}
                  max={30}
                  value={bookingWindowDays}
                  onChange={(e) => setBookingWindowDays(e.target.value)}
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
                  onChange={(e) => setSimultaneousBookingLimit(e.target.value)}
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

            <div>
              <div className={label}>Sportart</div>
              <div className="mt-1.5 flex gap-1">
                {(["TENNIS", "PADEL"] as const).map((s) => {
                  const on = sports.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      // at least one sport stays selected
                      onClick={() => setSports(on ? (sports.length > 1 ? sports.filter((x) => x !== s) : sports) : [...sports, s])}
                      className={chip(on)}
                    >
                      {SPORT_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 @min-[640px]:grid-cols-[1fr_120px_120px]">
              <label className="col-span-2 block @min-[640px]:col-span-1">
                <span className={label}>Kategorie</span>
                <input
                  list="planCategories"
                  maxLength={40}
                  placeholder="z. B. Junioren"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={input}
                />
                <datalist id="planCategories">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className={label}>Alter ab</span>
                <input type="number" min={0} max={120} placeholder="–" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={input} />
              </label>
              <label className="block">
                <span className={label}>Alter bis</span>
                <input type="number" min={0} max={120} placeholder="–" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={input} />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 @min-[640px]:grid-cols-2">
              <button type="button" aria-pressed={couple} onClick={() => setCouple(!couple)} className={toggleRow}>
                <span className="flex-1 text-[16px] font-semibold">Paar-Abo (2 Personen)</span>
                <SwitchKnob on={couple} />
              </button>
              <button type="button" aria-pressed={proofRequired} onClick={() => setProofRequired(!proofRequired)} className={toggleRow}>
                <span className="flex-1 text-[16px] font-semibold">Nachweis nötig (z. B. Ausweis)</span>
                <SwitchKnob on={proofRequired} />
              </button>
            </div>

            <div>
              <div className={label}>Spielzeiten</div>
              <button type="button" aria-pressed={windowOn} onClick={() => setWindowOn(!windowOn)} className={`${toggleRow} mt-1.5 w-full`}>
                <span className="flex-1 text-[16px] font-semibold">Nur zu bestimmten Zeiten</span>
                <SwitchKnob on={windowOn} />
              </button>
              {windowOn && (
                <div className="mt-2 rounded-[18px] border border-border bg-card p-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const on = windowDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setWindowDays(on ? windowDays.filter((x) => x !== d) : [...windowDays, d])}
                          className={`h-9 flex-1 rounded-[10px] text-[13px] font-bold ${on ? "bg-clay text-white" : "bg-inset"}`}
                        >
                          {WD[d]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className={label}>Von Uhr</span>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={fromHour}
                        onChange={(e) => setFromHour(e.target.value)}
                        className={input}
                      />
                    </label>
                    <label className="block">
                      <span className={label}>Bis Uhr</span>
                      <input type="number" min={1} max={24} value={toHour} onChange={(e) => setToHour(e.target.value)} className={input} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-pri !h-[50px] w-full active:scale-[.97] disabled:opacity-70"
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
          <>
            <div className="flex gap-1 rounded-[14px] bg-inset p-1">
              {(
                [
                  ["ALL", "Alle"],
                  ["TENNIS", "Tennis"],
                  ["PADEL", "Padel"],
                  ["BOTH", "Beides"],
                ] as const
              ).map(([k, text]) => (
                <button key={k} type="button" aria-pressed={sportFilter === k} onClick={() => setSportFilter(k)} className={chip(sportFilter === k)}>
                  {text}
                </button>
              ))}
            </div>
            {visiblePlans.length === 0 && (
              <p className="rounded-[20px] bg-inset px-4 py-5 text-center text-[15px] text-muted-foreground">Keine Tarife für diesen Filter.</p>
            )}
            {groups.map(([cat, group]) => (
              <div key={cat ?? ""}>
                <h3 className={`${label} mb-1.5 mt-2 px-1`}>{cat ?? "Ohne Kategorie"}</h3>
                <div className="overflow-hidden">
                  {group.map((plan) => {
                    const age = ageLabel(plan);
                    return (
                      <div key={plan.id} className="flex items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[16px] font-bold">{plan.name}</span>
                            <span className="rounded-full bg-paid-bg px-3 py-1 text-[13px] font-bold text-paid-fg">
                              {plan.currency} {plan.price} / Saison
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className={tag}>
                              {sportsOf(plan)
                                .map((s) => SPORT_LABEL[s])
                                .join(" + ")}
                            </span>
                            {plan.category && <span className={tag}>{plan.category}</span>}
                            {plan.persons === 2 && <span className={tag}>Paar</span>}
                            {age && <span className={tag}>{age}</span>}
                            {plan.playWindow && <span className={tag}>{playWindowLabel(plan.playWindow)}</span>}
                            {plan.proofRequired && <span className={tag}>Ausweis</span>}
                          </div>
                          {plan.description && <p className="mt-0.5 text-[14px] text-muted-foreground">{plan.description}</p>}
                          <p className="mt-1 text-[13px] text-muted-foreground">
                            Vorlauf {plan.bookingWindowDays} Tage · Max. aktiv {plan.simultaneousBookingLimit} ·{" "}
                            {plan.allowedDurations.join("/")} Min.
                            {plan.guestsPerWeek != null ? ` · ${plan.guestsPerWeek} Gäste/Woche` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                          <button type="button" onClick={() => openForm(plan)} aria-label={`Tarif ${plan.name} bearbeiten`} className={secondary}>
                            Bearbeiten
                          </button>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
