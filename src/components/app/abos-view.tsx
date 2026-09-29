"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/app/avatar";
import { Segmented } from "@/components/app/segmented";
import { playWindowLabel } from "@/lib/booking-rules";
import { stopAutoRenewAction } from "@/app/actions/abo";
import type { MembershipPlan } from "@/types";

type Sport = "TENNIS" | "PADEL" | "COMBO";
type Method = "STRIPE" | "OFFLINE_INVOICE";

const MAIN = ["Junioren", "Erwachsene", "Senioren"];
const HL = "Erwachsene";
const label = "text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const sportOf = (p: MembershipPlan): Sport => {
  const s = p.sports ?? ["TENNIS"];
  return s.includes("TENNIS") && s.includes("PADEL") ? "COMBO" : s[0] === "PADEL" ? "PADEL" : "TENNIS";
};
const catOf = (p: MembershipPlan) => p.category ?? p.name;
const personsOf = (p: MembershipPlan) => p.persons ?? 1;

/** "13–18 J." · "ab 65 J." · "bis 30 J. · Ausweis" · "Mo–Fr 8–16 Uhr" */
function condition(p: MembershipPlan) {
  const { ageMin: a, ageMax: b } = p;
  const age = a != null && b != null ? `${a}–${b} J.` : b != null ? `bis ${b} J.` : a != null ? `ab ${a} J.` : "";
  return [age, p.proofRequired ? "Ausweis" : "", p.playWindow ? playWindowLabel(p.playWindow) : ""].filter(Boolean).join(" · ");
}

const Check = () => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-clay">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export function AbosView({
  slug,
  clubName,
  loggedIn,
  plans,
  initialPlan,
  guestRate,
  guestRatePadel,
  guestFee,
  invoice,
  seasonYear,
  dinerLabel,
  membership,
}: {
  slug: string;
  clubName: string;
  loggedIn: boolean;
  plans: MembershipPlan[];
  initialPlan?: string;
  guestRate: number;
  guestRatePadel: number;
  guestFee: number;
  invoice: boolean;
  /** Year of the next 31 March (season end), computed on the server. */
  seasonYear: number;
  /** "Mo–Fr 11–13 Uhr" when Diner Tennis is on. */
  dinerLabel: string | null;
  membership: { planId: string; name: string; validity: string; renewal: string | null; autoRenew: boolean; renewDue: boolean } | null;
}) {
  const router = useRouter();
  const [stopping, startStop] = useTransition();
  const [autoRenew, setAutoRenew] = useState(false);
  const start = plans.find((p) => p.id === (initialPlan ?? membership?.planId));
  const sports = (["TENNIS", "PADEL", "COMBO"] as const).filter((s) => plans.some((p) => sportOf(p) === s));
  const [sport, setSport] = useState<Sport>(start ? sportOf(start) : (sports[0] ?? "TENNIS"));
  const [who, setWho] = useState<1 | 2>(start ? personsOf(start) : 1);
  const [sel, setSel] = useState(start?.id);
  const [year, setYear] = useState("");
  const [partner, setPartner] = useState({ firstName: "", lastName: "", email: "" });
  const [paying, setPaying] = useState<{ id: string; m: Method } | null>(null);

  const inSport = plans.filter((p) => sportOf(p) === sport);
  const hasCouple = inSport.some((p) => personsOf(p) === 2);
  const persons = hasCouple ? who : 1;
  const visible = inSport.filter((p) => personsOf(p) === persons);
  const mains = MAIN.map((c) => visible.find((p) => p.category === c)).filter((p): p is MembershipPlan => !!p);
  const rest = visible.filter((p) => !MAIN.includes(p.category ?? ""));
  const hlPlan = mains.find((p) => p.category === HL);
  const sp = visible.find((p) => p.id === sel) ?? hlPlan ?? mains[0] ?? visible[0];

  // Tennis + Padel as separate Abos minus the combo price, same category and persons
  const priceOf = (s: Sport, cat: string, n: number) => plans.find((p) => sportOf(p) === s && catOf(p) === cat && personsOf(p) === n)?.price;
  const saving = (p: MembershipPlan) => {
    const t = priceOf("TENNIS", catOf(p), personsOf(p));
    const d = priceOf("PADEL", catOf(p), personsOf(p));
    return t != null && d != null && sportOf(p) === "COMBO" ? t + d - p.price : 0;
  };
  const maxSaving = Math.max(0, ...plans.map(saving));

  // Jahrgang → narrowest age range that fits (no proof needed), Erwachsene otherwise
  const y = parseInt(year, 10);
  const age = y > 1900 && y <= new Date().getFullYear() ? new Date().getFullYear() - y : null;
  const aged = inSport.filter((p) => p.ageMin != null || p.ageMax != null);
  const fits = (p: MembershipPlan) => age != null && age >= (p.ageMin ?? 0) && age <= (p.ageMax ?? 200);
  const width = (p: MembershipPlan) => (p.ageMax ?? 200) - (p.ageMin ?? 0);
  const fitPlan = age == null ? undefined : aged.filter((p) => fits(p) && !p.proofRequired).sort((a, b) => width(a) - width(b))[0];
  const fitCat = age == null ? null : fitPlan ? catOf(fitPlan) : inSport.some((p) => p.category === HL) ? HL : null;
  const fitPrice = inSport.find((p) => catOf(p) === fitCat && personsOf(p) === 1)?.price ?? Infinity;
  const proofTip = aged.find((p) => p.proofRequired && fits(p) && personsOf(p) === 1 && p.price < fitPrice);

  const rate = sport === "PADEL" ? guestRatePadel : guestRate;
  const registerHref = (id: string) => `/c/${slug}/profile?register=1&next=${encodeURIComponent(`/c/${slug}/abos?plan=${id}`)}`;

  async function pay(p: MembershipPlan, paymentMethod: Method) {
    if (paying) return;
    const couple = personsOf(p) === 2;
    if (couple && (!partner.firstName.trim() || !partner.lastName.trim() || !partner.email.trim())) {
      setSel(p.id);
      return toast("Bitte gib Vorname, Nachname und E-Mail der zweiten Person an.");
    }
    setPaying({ id: p.id, m: paymentMethod });
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: p.id, paymentMethod, ...(couple && { partner }), ...(autoRenew && paymentMethod === "STRIPE" && { autoRenew: true }) }),
      });
      const j: { url?: string; error?: string } = await r.json();
      if (j.url) return window.location.assign(j.url);
      toast(j.error ?? "Zahlung fehlgeschlagen");
    } catch {
      toast("Zahlung fehlgeschlagen");
    }
    setPaying(null);
  }

  const features = (p: MembershipPlan) =>
    [
      sportOf(p) !== "PADEL" ? "Alle Tennisplätze ohne Platzgebühr" : "",
      sportOf(p) !== "TENNIS" ? "Padel-Court ohne Platzgebühr" : "",
      p.playWindow ? `Nur ${playWindowLabel(p.playWindow)}` : "",
      `Online reservieren bis ${p.bookingWindowDays} Tage im Voraus`,
      personsOf(p) === 2 ? "Zwei Personen, zwei Konten" : "",
      saving(p) > 0 ? `CHF ${fmt(saving(p))} günstiger als einzeln` : "",
      p.proofRequired ? "Ausweis beim Club einreichen" : "",
    ].filter(Boolean);

  const sub = (p: MembershipPlan) =>
    personsOf(p) === 2
      ? `CHF ${fmt(p.price / 2)} pro Person`
      : sport !== "COMBO" && rate > 0
        ? `Als Gast nach ${Math.ceil(p.price / rate)} Stunden bezahlt`
        : "";

  const input = "h-11 w-full min-w-0 rounded-[12px] border border-border px-3 text-[16px] text-foreground outline-none focus-visible:border-clay";
  const partnerForm = (bg: string) => (
    <div className="flex flex-col gap-2">
      <div className={label}>Zweite Person</div>
      <div className="grid grid-cols-2 gap-2">
        <input aria-label="Vorname" placeholder="Vorname" autoComplete="off" value={partner.firstName} onChange={(e) => setPartner({ ...partner, firstName: e.target.value })} className={`${input} ${bg}`} />
        <input aria-label="Nachname" placeholder="Nachname" autoComplete="off" value={partner.lastName} onChange={(e) => setPartner({ ...partner, lastName: e.target.value })} className={`${input} ${bg}`} />
      </div>
      <input aria-label="E-Mail" type="email" placeholder="E-Mail" autoComplete="off" value={partner.email} onChange={(e) => setPartner({ ...partner, email: e.target.value })} className={`${input} ${bg}`} />
      <div className="text-[13px] leading-[1.4] text-muted-foreground">Die zweite Person bekommt einen Link, um ihr Passwort zu setzen.</div>
    </div>
  );

  const payButtons = (p: MembershipPlan, primary: boolean) => {
    const busy = paying?.id === p.id ? paying.m : null;
    const main = `flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[17px] text-[16px] font-extrabold active:scale-[.97] ${primary ? "bg-clay text-white shadow-[0_8px_24px_rgba(226,91,54,.28)]" : "bg-inset text-clay-text"}`;
    const ghost = "flex h-10 w-full items-center justify-center gap-2 rounded-[14px] text-[14px] font-bold text-muted-foreground";
    const text = `${autoRenew ? "Mit Karte" : "Mit Twint oder Karte"} · CHF ${fmt(p.price)}`;
    const onInvoice = invoice && personsOf(p) === 1;
    return (
      <div className="flex flex-col gap-2">
        {renewBox}
        {loggedIn ? (
          <button type="button" onClick={() => pay(p, "STRIPE")} disabled={!!paying} className={main}>
            {busy === "STRIPE" && <Spinner />}
            {busy === "STRIPE" ? "Weiterleiten…" : text}
          </button>
        ) : (
          <Link href={registerHref(p.id)} className={main}>{text}</Link>
        )}
        {onInvoice &&
          (loggedIn ? (
            <button type="button" onClick={() => pay(p, "OFFLINE_INVOICE")} disabled={!!paying} className={ghost}>
              {busy === "OFFLINE_INVOICE" && <Spinner />}Auf Rechnung zahlen
            </button>
          ) : (
            <Link href={registerHref(p.id)} className={ghost}>Auf Rechnung zahlen</Link>
          ))}
      </div>
    );
  };

  const renewBox = loggedIn && (
    <label className="flex cursor-pointer items-center gap-2.5 px-1 py-1 text-[14px] font-semibold text-muted-foreground">
      <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="size-[18px] shrink-0 accent-clay" />
      Automatisch jedes Jahr verlängern (nur mit Karte)
    </label>
  );

  const current = membership && plans.find((p) => p.id === membership.planId);
  function renew(p: MembershipPlan) {
    setSport(sportOf(p));
    setWho(personsOf(p));
    setSel(p.id);
    // Paar-Abo needs the partner form, which lives with the selected plan
    if (personsOf(p) === 2 && loggedIn) return toast("Bitte gib unten die Angaben der zweiten Person an.");
    pay(p, "STRIPE");
  }
  function stop() {
    startStop(async () => {
      const r = await stopAutoRenewAction(slug);
      if ("error" in r) return void toast(r.error);
      toast("Automatische Verlängerung ausgeschaltet");
      router.refresh();
    });
  }

  const adult = hlPlan ?? mains[0];
  const anchor =
    !adult ? null : sport === "COMBO" ? (
      saving(adult) > 0 && (
        <>
          Tennis und Padel zusammen: {catOf(adult)} sparen <strong className="text-foreground">CHF {fmt(saving(adult))}</strong> gegenüber zwei einzelnen Abos.
        </>
      )
    ) : (
      rate > 0 && (
        <>
          Als Gast zahlst du <strong className="text-foreground">CHF {fmt(rate)} pro Stunde</strong>
          {sport === "PADEL" ? " Padel" : ""}. Das {catOf(adult)}-Abo ist nach{" "}
          <strong className="text-foreground">{Math.ceil(adult.price / rate)} Stunden</strong> bezahlt, danach spielst du bis 31. März ohne Platzgebühr.
        </>
      )
    );

  const dot = (bg: string) => <span aria-hidden className="size-[9px] shrink-0 rounded-full" style={{ background: bg }} />;
  const sportLabel: Record<Sport, ReactNode> = {
    TENNIS: <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 lg:px-4">{dot("var(--surface-clay)")}Tennis</span>,
    PADEL: <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 lg:px-4">{dot("var(--surface-padel)")}Padel</span>,
    COMBO: (
      <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 lg:px-4">
        {dot("linear-gradient(90deg,var(--surface-clay) 50%,var(--surface-padel) 50%)")}Beides
        {maxSaving > 0 && <span className="rounded-full bg-paid-bg px-[7px] py-0.5 text-[11px] font-extrabold text-paid-fg">spart bis {fmt(maxSaving)}</span>}
      </span>
    ),
  };
  const footerOnDesktop = sp && !mains.includes(sp);

  return (
    <div className="lg:mx-auto lg:max-w-[1180px] lg:px-5">
      <header className="px-5 pt-[66px] lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-6 lg:px-0 lg:pt-12">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-[.08em] text-clay-text">Mitgliedschaften · {clubName}</div>
          <h1 className="mt-2 text-balance text-[34px] font-extrabold leading-[1.05] tracking-[-.04em] lg:text-[56px] lg:leading-[1.02] lg:tracking-[-.045em]">
            Eine Saison. Alle Plätze.
          </h1>
          <p className="mt-3 max-w-[56ch] text-[16px] leading-[1.45] text-muted-foreground lg:text-[17px]">
            Einmal zahlen, bis 31. März {seasonYear} ohne Platzgebühr spielen. Mit Twint, Karte{invoice ? " oder auf Rechnung" : ""}, sofort freigeschaltet.
          </p>
        </div>
        {plans.length > 0 && (
          <div className="mt-5 flex flex-col gap-2.5 lg:mt-0 lg:items-end">
            {sports.length > 1 && (
              <Segmented label="Sportart" size="lg" value={sport} onChange={setSport} options={sports.map((s) => [s, sportLabel[s]] as const)} />
            )}
            {hasCouple && (
              <Segmented
                label="Für wen"
                size="lg"
                value={persons}
                onChange={setWho}
                options={[
                  [1, <span key="1" className="whitespace-nowrap px-3 lg:px-4">Für mich</span>],
                  [2, <span key="2" className="whitespace-nowrap px-3 lg:px-4">Als Paar</span>],
                ]}
              />
            )}
          </div>
        )}
      </header>

      {membership && (
        <div className="mx-5 mt-5 rounded-[26px] border border-border bg-card p-5 lg:mx-0">
          <div className={label}>Dein Abo</div>
          <div className="mt-[3px] text-[22px] font-bold tracking-[-.02em]">{membership.name}</div>
          <div className="mt-px text-[14px] text-muted-foreground">{membership.validity}</div>
          {membership.renewal && <div className="mt-px text-[14px] font-semibold text-paid-fg">{membership.renewal}</div>}
          {membership.autoRenew && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[16px] bg-inset px-4 py-3">
              <span className="text-[15px] font-semibold">Verlängert sich automatisch</span>
              <button type="button" onClick={stop} disabled={stopping} className="text-[15px] font-bold text-clay-text">
                {stopping ? "Ausschalten…" : "Ausschalten"}
              </button>
            </div>
          )}
          {membership.renewDue && !membership.autoRenew && current && (
            <div className="mt-4 flex flex-col gap-2">
              {renewBox}
              <button
                type="button"
                onClick={() => renew(current)}
                disabled={!!paying}
                className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-clay text-[16px] font-extrabold text-white shadow-[0_8px_24px_rgba(226,91,54,.28)] active:scale-[.97]"
              >
                {paying?.id === current.id && <Spinner />}Für nächste Saison verlängern · CHF {fmt(current.price)}
              </button>
            </div>
          )}
        </div>
      )}

      {plans.length === 0 ? (
        <div className="mx-5 mt-5 rounded-[22px] bg-inset px-[18px] py-4 text-[15px] leading-[1.45] text-muted-foreground lg:mx-0">
          Der Club hat noch keine Abos eingerichtet.
        </div>
      ) : (
        <>
          {(anchor || aged.length > 0) && (
            <div className="mx-5 mt-5 grid gap-2.5 lg:mx-0 lg:mt-7 lg:grid-cols-[1.4fr_1fr] lg:gap-3">
              {anchor && <div className="rounded-[20px] bg-inset px-[18px] py-4 text-[15px] leading-[1.45] text-muted-foreground">{anchor}</div>}
              {aged.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-inset px-[18px] py-3 text-[15px] text-muted-foreground">
                  <label htmlFor="abo-year" className="font-bold text-foreground">Jahrgang</label>
                  <input
                    id="abo-year"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1988"
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                    className="h-11 w-24 rounded-[12px] border border-border bg-card px-3 text-[16px] text-foreground outline-none focus-visible:border-clay"
                  />
                  <output htmlFor="abo-year" className="font-bold text-clay-text">
                    {fitCat ? `→ ${fitCat}${proofTip ? ` (mit Ausweis: ${catOf(proofTip)})` : ""}` : "Jahrgang eingeben"}
                  </output>
                </div>
              )}
            </div>
          )}

          {mains.length > 0 && (
            <section aria-label="Haupttarife" className="mx-5 mt-4 flex flex-col gap-4 lg:mx-0 lg:mt-11 lg:grid lg:items-center lg:justify-center lg:gap-7" style={{ gridTemplateColumns: `repeat(${mains.length}, minmax(0, 380px))` }}>
              {mains.map((p) => {
                const hl = p === hlPlan;
                const on = p === sp;
                return (
                  <article
                    key={p.id}
                    className={`relative flex flex-col gap-[18px] rounded-[30px] border-2 bg-card px-7 pb-[26px] pt-[30px] transition-[transform,border-color] duration-[450ms] ease-spring ${on ? "border-clay" : "border-border"} ${hl ? "max-lg:order-first max-lg:mt-3 lg:-translate-y-4 lg:border-clay lg:pb-8 lg:pt-10 lg:shadow-elevation lg:hover:-translate-y-5" : "lg:border-border lg:hover:-translate-y-1"} ${fitCat === catOf(p) ? "outline-3 outline-offset-4 outline-clay" : ""}`}
                  >
                    {hl && (
                      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-clay px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-[.08em] text-white">
                        Am beliebtesten
                      </span>
                    )}
                    <button type="button" aria-pressed={on} onClick={() => setSel(p.id)} className="flex flex-col gap-[18px] text-left lg:cursor-default">
                      <div>
                        <h2 className="text-[24px] font-extrabold tracking-[-.03em]">{catOf(p)}</h2>
                        {condition(p) && <span className="mt-1.5 inline-flex rounded-full bg-inset px-2.5 py-[3px] text-[13px] font-bold text-muted-foreground">{condition(p)}</span>}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[22px] font-bold text-muted-foreground">CHF</span>
                          <span className="text-[56px] font-extrabold leading-none tracking-[-.05em] lg:text-[64px]">{fmt(p.price)}</span>
                          <span className="text-[16px] font-semibold text-muted-foreground">/ Saison</span>
                        </div>
                        <div className="mt-2 min-h-5 text-[14px] text-muted-foreground">{sub(p)}</div>
                      </div>
                      <ul className="flex flex-col gap-2.5">
                        {features(p).map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-[15px] font-semibold">
                            <Check />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                    <div className="mt-auto hidden flex-col gap-4 lg:flex">
                      {loggedIn && on && personsOf(p) === 2 && partnerForm("bg-inset")}
                      {payButtons(p, hl)}
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {rest.length > 0 && (
            <>
              <div className="mx-5 mt-10 flex flex-wrap items-baseline justify-between gap-3 lg:mx-0 lg:mt-14">
                <h2 className="text-[22px] font-bold tracking-[-.02em]">Weitere Tarife</h2>
                <span className="text-[14px] text-muted-foreground">Ermässigungen mit Alters- oder Ausweis-Nachweis</span>
              </div>
              <section aria-label="Weitere Tarife" className="mx-5 mt-3.5 grid grid-cols-2 gap-3 lg:mx-0 lg:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
                {rest.map((p) => {
                  const on = p === sp;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSel(p.id)}
                      className={`flex flex-col gap-1.5 rounded-[22px] border-2 bg-card p-[18px] text-left transition-[border-color] duration-[250ms] hover:border-clay ${on ? "border-clay" : "border-border"} ${fitCat === catOf(p) ? "outline-3 outline-offset-3 outline-clay" : ""}`}
                    >
                      <span className="text-[17px] font-extrabold leading-[1.25]">{catOf(p)}</span>
                      {condition(p) && <span className="text-[13px] font-semibold text-muted-foreground">{condition(p)}</span>}
                      <span className="mt-1.5 text-[26px] font-extrabold tracking-[-.03em]">
                        CHF {fmt(p.price)}
                        {/* own line: two mini cards per phone row are too narrow for price + suffix */}
                        <small className="block text-[13px] font-semibold tracking-normal text-muted-foreground lg:ml-1.5 lg:inline">/ Saison</small>
                      </span>
                      <span className="text-[13px] font-bold text-clay-text">{on ? "Ausgewählt" : "Auswählen"}</span>
                    </button>
                  );
                })}
              </section>
            </>
          )}

          <div className="mx-5 mt-10 grid gap-5 border-t border-border pt-7 text-[14px] leading-[1.45] text-muted-foreground lg:mx-0 lg:mt-14 lg:grid-cols-3 lg:gap-6">
            <div>
              <b className="mb-0.5 block text-[15px] text-foreground">Sofort freigeschaltet</b>Nach der Zahlung mit Twint oder Karte buchst du direkt. Keine Woche warten.
            </div>
            <div>
              <b className="mb-0.5 block text-[15px] text-foreground">Gültig bis 31. März {seasonYear}</b>Verlängern bis 31. März, dann läuft es nahtlos weiter.
            </div>
            <div>
              {dinerLabel ? (
                <>
                  <b className="mb-0.5 block text-[15px] text-foreground">Diner Tennis</b>
                  {dinerLabel} spielt dein Gast gratis, wenn ihr danach im Club zu Mittag esst.
                </>
              ) : (
                <>
                  <b className="mb-0.5 block text-[15px] text-foreground">Gäste willkommen</b>Nichtmitglieder spielen mit dir für CHF {fmt(guestFee)} pro Person.
                </>
              )}
            </div>
          </div>
        </>
      )}

      {sp && sp.price > 0 && (
        <div
          className={`sticky bottom-[calc(max(10px,env(safe-area-inset-bottom))+76px)] z-20 mx-3 mt-6 flex flex-col gap-3 rounded-[26px] border border-border bg-glass p-3 shadow-elevation backdrop-blur-[24px] backdrop-saturate-[1.6] lg:bottom-6 lg:mx-0 ${footerOnDesktop ? "lg:flex-row lg:items-end" : "lg:hidden"}`}
        >
          {loggedIn && personsOf(sp) === 2 && <div className="px-1 pt-1 lg:flex-1">{partnerForm("bg-card")}</div>}
          <div className="lg:w-[420px]">
            <div className="px-1 pb-2 text-[13px] font-semibold text-muted-foreground">
              {catOf(sp)} · CHF {fmt(sp.price)} / Saison
            </div>
            {payButtons(sp, true)}
          </div>
        </div>
      )}
      <div className="h-8" />
    </div>
  );
}
