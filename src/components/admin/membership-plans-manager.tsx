"use client";

import { useMemo, useState } from "react";
import { MembershipPlan, SportType } from "@/types";
import { createMembershipPlanAction, deleteMembershipPlanAction, updateMembershipPlanAction } from "@/app/actions/club-settings";
import { playWindowLabel } from "@/lib/booking-rules";
import { SwitchKnob } from "@/components/app/switch";
import { Spinner } from "@/components/app/avatar";
import { Sheet } from "@/components/app/sheet";
import { Segmented } from "@/components/app/segmented";

const label = "block truncate text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-card px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-clay";
const secondary = "shrink-0 rounded-[12px] bg-inset px-3.5 py-2 text-[14px] font-bold text-clay-text disabled:opacity-60";
const tag = "rounded-full bg-inset px-2.5 py-0.5 text-[12px] font-bold text-muted-foreground";
const chip = (on: boolean) => `h-9 flex-1 rounded-[10px] text-[13px] font-bold ${on ? "bg-clay text-white" : "bg-card"}`;
const group = "mb-1 text-[12px] font-bold uppercase tracking-[.06em] text-ink-3";
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
  const [otherCat, setOtherCat] = useState(false);
  const ageWrong = ageMin !== "" && ageMax !== "" && Number(ageMin) > Number(ageMax);
  const summary = [
    `${name.trim() || "Ohne Namen"}${ageMin || ageMax ? `, ${ageMin && ageMax ? `${ageMin}–${ageMax}` : ageMin ? `ab ${ageMin}` : `bis ${ageMax}`} Jahre` : ""}${couple ? ", für 2 Personen" : ""}: ${currency} ${price || "?"} pro Saison.`,
    proofRequired ? "Ausweis nötig." : "",
    `Bucht bis ${bookingWindowDays || "?"} Tage im Voraus, höchstens ${simultaneousBookingLimit || "?"} offene Buchungen, ${[allow60 && "60", allow90 && "90"].filter(Boolean).join(" oder ")} Min., ${guestsPerWeek === "" ? "beliebig viele Gäste" : `${guestsPerWeek} ${guestsPerWeek === "1" ? "Gast" : "Gäste"} pro Woche`}, ${windowOn ? `nur ${windowDays.length ? [1, 2, 3, 4, 5, 6, 0].filter((d) => windowDays.includes(d)).map((d) => WD[d]).join(", ") : "an keinem Tag"} ${fromHour}–${toHour} Uhr` : "jederzeit"}.`,
  ].filter(Boolean).join(" ");

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
    setOtherCat(Boolean(plan?.category && !CATEGORIES.includes(plan.category)));
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
          message: editingId ? `Abo "${saved.name}" gespeichert.` : `Abo "${saved.name}" hinzugefügt.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Abo konnte nicht gespeichert werden.",
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
          message: `Abo "${planName}" archiviert, für neue Mitglieder nicht mehr wählbar.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Abo konnte nicht entfernt werden.",
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
          <h2 className="text-[22px] font-bold tracking-[-.02em]">Abos ({plans.length})</h2>
          <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">Antippen «Bearbeiten», um Preis und Regeln zu ändern.</p>
        </div>
        <button type="button" aria-expanded={showAddForm} onClick={() => openForm()} className={secondary}>
          + Abo
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

        {plans.length === 0 ? (
          <p className="rounded-[20px] bg-inset px-4 py-5 text-center text-[15px] text-muted-foreground">
            Noch keine Abos. Tippe auf «+ Abo».
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
              <p className="rounded-[20px] bg-inset px-4 py-5 text-center text-[15px] text-muted-foreground">Keine Abos für diesen Filter.</p>
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
                          <button type="button" onClick={() => openForm(plan)} aria-label={`Abo ${plan.name} bearbeiten`} className={secondary}>
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === plan.id}
                            onClick={() => handleDeletePlan(plan.id, plan.name)}
                            aria-label={`Abo ${plan.name} entfernen`}
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
      <Sheet open={showAddForm} onOpenChange={(o) => !o && setShowAddForm(false)} title={editingId ? "Abo bearbeiten" : "Neues Abo"}>
        <form onSubmit={handleCreatePlan} className="flex flex-col gap-5">
          <div role="status" className="rounded-[18px] bg-brand-tint px-4 py-3 text-[14px] leading-[1.4] text-brand-deep">
            <b className="block text-[12px] uppercase tracking-[.06em]">So sieht es das Mitglied</b>
            {summary}
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className={group}>Grunddaten</legend>
            <label className="block">
              <span className={label}>Name <span className="text-bad">*</span></span>
              <input id="planName" placeholder="z. B. Studierende" value={name} onChange={(e) => setName(e.target.value)} required className={input} />
            </label>
            <label className="block">
              <span className={label}>Preis pro Saison <span className="text-bad">*</span></span>
              <span className="flex items-center gap-2.5">
                <input id="price" type="number" min={0} step={1} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required className={`${input} max-w-[120px]`} />
                <select id="currency" aria-label="Währung" value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${input} max-w-[96px]`}>
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                </select>
              </span>
            </label>
            <label className="block">
              <span className={label}>Beschreibung</span>
              <input id="planDesc" placeholder="z. B. Mit gültigem Studentenausweis" value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className={group}>Für wen</legend>
            <div>
              <span className={label}>Kategorie</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" aria-pressed={category === c} onClick={() => { setOtherCat(false); setCategory(category === c ? "" : c); }} className="chip">
                    {c}
                  </button>
                ))}
                <button type="button" aria-pressed={otherCat} onClick={() => { setOtherCat(true); setCategory(""); }} className="chip">
                  Andere…
                </button>
              </div>
              {otherCat && <input aria-label="Andere Kategorie" maxLength={40} placeholder="Name der Kategorie" value={category} onChange={(e) => setCategory(e.target.value)} className={input} />}
            </div>
            <div>
              <span className={label}>Alter</span>
              <span className="mt-1.5 flex items-center gap-2.5 text-[15px] text-muted-foreground">
                <input type="number" min={0} max={120} aria-label="Alter von" placeholder="–" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={`${input} mt-0 max-w-[90px]`} />
                bis
                <input type="number" min={0} max={120} aria-label="Alter bis" placeholder="–" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={`${input} mt-0 max-w-[90px]`} />
                Jahre
              </span>
              {ageWrong && <span className="mt-1.5 block text-[13px] font-semibold text-bad">«Von» muss kleiner sein als «bis».</span>}
              <span className="mt-1.5 block text-[13px] text-muted-foreground">Leer lassen = jedes Alter.</span>
            </div>
            <button type="button" aria-pressed={proofRequired} onClick={() => setProofRequired(!proofRequired)} className={toggleRow}>
              <span className="flex-1"><b className="block text-[16px]">Ausweis nötig</b><small className="block text-[13px] text-muted-foreground">Mitglied muss einen Nachweis zeigen</small></span>
              <SwitchKnob on={proofRequired} />
            </button>
            <button type="button" aria-pressed={couple} onClick={() => setCouple(!couple)} className={toggleRow}>
              <span className="flex-1"><b className="block text-[16px]">Für 2 Personen</b><small className="block text-[13px] text-muted-foreground">Paar-Abo</small></span>
              <SwitchKnob on={couple} />
            </button>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className={group}>Buchen</legend>
            <div>
              <span className={label}>Sportart</span>
              <div className="mt-1.5 flex gap-2">
                {(["TENNIS", "PADEL"] as const).map((sp) => {
                  const on = sports.includes(sp);
                  return (
                    // at least one sport stays selected
                    <button key={sp} type="button" aria-pressed={on} onClick={() => setSports(on ? (sports.length > 1 ? sports.filter((x) => x !== sp) : sports) : [...sports, sp])} className="chip">
                      {SPORT_LABEL[sp]}
                    </button>
                  );
                })}
              </div>
            </div>
            {(
              [
                ["bookingWindowDays", "Wie weit im Voraus buchbar", bookingWindowDays, setBookingWindowDays, "Tage", 1, 30, ""],
                ["simultaneousBookingLimit", "Offene Buchungen gleichzeitig", simultaneousBookingLimit, setSimultaneousBookingLimit, "Buchungen", 1, 10, "Eine neue Buchung geht erst, wenn eine gespielt oder storniert ist."],
                ["guestsPerWeek", "Gäste pro Woche", guestsPerWeek, setGuestsPerWeek, "Gäste", 0, 20, "Leer lassen = beliebig viele."],
              ] as const
            ).map(([id, text, value, set, u, min, max, help]) => (
              <label key={id} className="block">
                <span className={label}>{text}</span>
                <span className="flex items-center gap-2.5">
                  <input id={id} type="number" inputMode="numeric" min={min} max={max} placeholder={id === "guestsPerWeek" ? "∞" : undefined} value={value} onChange={(e) => set(e.target.value)} className={`${input} max-w-[90px]`} />
                  <span className="mt-1.5 text-[15px] text-muted-foreground">{u}</span>
                </span>
                {help && <span className="mt-1.5 block text-[13px] text-muted-foreground">{help}</span>}
              </label>
            ))}
            <div>
              <span className={label}>Spieldauer</span>
              <div className="mt-1.5 flex gap-2">
                {(
                  [
                    ["60 Min.", allow60, setAllow60, allow90],
                    ["90 Min.", allow90, setAllow90, allow60],
                  ] as const
                ).map(([text, on, set, other]) => (
                  // one duration always stays on
                  <button key={text} type="button" aria-pressed={on} onClick={() => (on && !other ? null : set(!on))} className="chip">
                    {text}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className={group}>Wann spielbar</legend>
            <Segmented label="Wann spielbar" options={[["always", "Immer"], ["window", "Nur bestimmte Zeiten"]] as const} value={windowOn ? "window" : "always"} onChange={(v) => setWindowOn(v === "window")} />
            {windowOn && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const on = windowDays.includes(d);
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => setWindowDays(on ? windowDays.filter((x) => x !== d) : [...windowDays, d])} className={`h-10 flex-1 rounded-[10px] text-[13px] font-bold ${on ? "bg-clay text-white" : "bg-inset"}`}>
                        {WD[d]}
                      </button>
                    );
                  })}
                </div>
                <span className="flex items-center gap-2.5 text-[15px] text-muted-foreground">
                  von
                  <input type="number" min={0} max={23} aria-label="Von Uhr" value={fromHour} onChange={(e) => setFromHour(e.target.value)} className={`${input} mt-0 max-w-[80px]`} />
                  bis
                  <input type="number" min={1} max={24} aria-label="Bis Uhr" value={toHour} onChange={(e) => setToHour(e.target.value)} className={`${input} mt-0 max-w-[80px]`} />
                  Uhr
                </span>
              </div>
            )}
          </fieldset>

          <div className="sticky bottom-0 -mx-1 bg-card px-1 pb-1 pt-2">
            <button type="submit" disabled={loading || ageWrong} className="btn btn-pri !h-[50px] w-full active:scale-[.97] disabled:opacity-70">
              {loading && <Spinner />}
              Speichern
            </button>
          </div>
        </form>
      </Sheet>
    </section>
  );
}
