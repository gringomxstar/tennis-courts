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
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-brand-deep">
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
  invoice: boolean;
  /** Year of the next 31 March (season end), computed on the server. */
  seasonYear: number;
  /** "Mo–Fr 11–13 Uhr" when Diner Tennis is on. */
  dinerLabel: string | null;
  membership: { planId: string; name: string; validity: string; renewal: string | null; autoRenew: boolean; renewDue: boolean } | null;
}) {
  const router = useRouter();
  const [stopping, startStop] = useTransition();
  const start = plans.find((p) => p.id === (initialPlan ?? membership?.planId));
  const sports = (["TENNIS", "PADEL", "COMBO"] as const).filter((s) => plans.some((p) => sportOf(p) === s));
  const [sport, setSport] = useState<Sport>(start ? sportOf(start) : (sports[0] ?? "TENNIS"));
  const [who, setWho] = useState<1 | 2>(start ? personsOf(start) : 1);
  const [sel, setSel] = useState(initialPlan ? start?.id : undefined);
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
  // a guest pays their share of the court: tennis 2 players, padel 4
  const players = sport === "PADEL" ? 4 : 2;
  const share = rate / players;
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
        body: JSON.stringify({ planId: p.id, paymentMethod, ...(couple && { partner }) }),
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
        ? `Als Gast nach ${Math.ceil(p.price / share)} Stunden bezahlt`
        : "";

  const input = "h-12 w-full min-w-0 rounded-[14px] bg-bg px-4 text-[15px] text-ink outline-none focus:shadow-[inset_0_0_0_2px_var(--brand-deep)]";
  const partnerForm = (
    <div className="card flex flex-col gap-2.5 p-5">
      <h2 className="text-[17px] font-bold">Zweite Person</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <input aria-label="Vorname" placeholder="Vorname" autoComplete="off" value={partner.firstName} onChange={(e) => setPartner({ ...partner, firstName: e.target.value })} className={input} />
        <input aria-label="Nachname" placeholder="Nachname" autoComplete="off" value={partner.lastName} onChange={(e) => setPartner({ ...partner, lastName: e.target.value })} className={input} />
      </div>
      <input aria-label="E-Mail" type="email" placeholder="E-Mail" autoComplete="off" value={partner.email} onChange={(e) => setPartner({ ...partner, email: e.target.value })} className={input} />
      <div className="text-[13px] leading-[1.4] text-ink-2">Die zweite Person bekommt einen Link, um ihr Passwort zu setzen.</div>
    </div>
  );

  // One button per Abo: "Bezahlen · CHF x" (member) or "Konto erstellen und bezahlen · CHF x" (new, registers first)
  const payButtons = (p: MembershipPlan, primary: boolean) => {
    const busy = paying?.id === p.id ? paying.m : null;
    const main = `btn h-[54px] w-full text-[16px] ${primary ? "btn-pri" : "bg-brand-tint text-brand-deep shadow-none"}`;
    const text = `${loggedIn ? "Bezahlen" : "Konto erstellen und bezahlen"} · CHF ${fmt(p.price)}`;
    const onInvoice = invoice && personsOf(p) === 1;
    return (
      <div className="flex flex-col gap-1">
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
            <button type="button" onClick={() => pay(p, "OFFLINE_INVOICE")} disabled={!!paying} className="h-10 text-[14px] font-semibold text-ink-2">
              {busy === "OFFLINE_INVOICE" ? "Weiterleiten…" : "Auf Rechnung zahlen"}
            </button>
          ) : (
            <Link href={registerHref(p.id)} className="flex h-10 items-center justify-center text-[14px] font-semibold text-ink-2">Auf Rechnung zahlen</Link>
          ))}
      </div>
    );
  };

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
          Als Gast zahlst du <strong className="text-foreground">CHF {fmt(share)} pro Stunde</strong>
          {sport === "PADEL" ? " Padel" : ""} (Platz CHF {fmt(rate)}, geteilt zu {players === 4 ? "viert" : "zweit"}). Das {catOf(adult)}-Abo ist nach{" "}
          <strong className="text-foreground">{Math.ceil(adult.price / share)} Stunden</strong> bezahlt, danach spielst du bis 31. März ohne Platzgebühr.
        </>
      )
    );

  const dot = (bg: string) => <span aria-hidden className="size-[9px] shrink-0 rounded-full" style={{ background: bg }} />;
  const seg = "inline-flex items-center justify-center gap-2 whitespace-nowrap px-3";
  const sportLabel: Record<Sport, ReactNode> = {
    TENNIS: <span className={seg}>{dot("var(--sand)")}Tennis</span>,
    PADEL: <span className={seg}>{dot("var(--padel)")}Padel</span>,
    COMBO: (
      <span className={seg}>
        {dot("linear-gradient(90deg,var(--sand) 50%,var(--padel) 50%)")}Beides
        {maxSaving > 0 && <small className="hidden opacity-70 @min-[640px]:inline">spart bis {fmt(maxSaving)}</small>}
      </span>
    ),
  };
  const restSelected = sp && !mains.includes(sp);
  const gridCols = mains.length >= 3 ? "@min-[1024px]:grid-cols-3" : "";

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 pb-8 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-.03em] @min-[640px]:text-[32px]">{loggedIn ? "Abos" : "Mitglied werden"}</h1>
        <div className="mt-1 max-w-[60ch] text-[14px] text-ink-2">
          Dein Platz. Die ganze Saison. Einmal zahlen, bis 31. März {seasonYear} spielen, ohne Platzgebühr. {clubName}
        </div>
      </div>

      {membership && (
        <div className="card flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">Dein Abo</h2>
            <span className="pill bg-ok-bg text-ok">{membership.validity}</span>
          </div>
          <b className="text-[16px]">{membership.name}</b>
          {membership.renewal && <div className="text-[14px] font-semibold text-ok">{membership.renewal}</div>}
          {membership.autoRenew && (
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-[14px] font-semibold">Verlängert sich noch automatisch</span>
              <button type="button" onClick={stop} disabled={stopping} className="text-[14px] font-bold text-brand-deep">
                {stopping ? "Ausschalten…" : "Ausschalten"}
              </button>
            </div>
          )}
          {membership.renewDue && !membership.autoRenew && current && (
            <button type="button" onClick={() => renew(current)} disabled={!!paying} className="btn btn-pri mt-1 h-[54px] w-full text-[16px]">
              {paying?.id === current.id && <Spinner />}Bezahlen · CHF {fmt(current.price)} für die nächste Saison
            </button>
          )}
        </div>
      )}

      {plans.length === 0 ? (
        <div className="card px-5 py-4 text-[15px] leading-[1.45] text-ink-2">Der Club hat noch keine Abos eingerichtet.</div>
      ) : (
        <>
          <div className="card flex flex-col gap-3.5 p-5">
            <div className="flex flex-col gap-3 @min-[640px]:flex-row @min-[640px]:items-end">
              {sports.length > 1 && <Segmented label="Sportart" size="lg" value={sport} onChange={setSport} options={sports.map((s) => [s, sportLabel[s]] as const)} />}
              {hasCouple && (
                <Segmented
                  label="Für wen"
                  size="lg"
                  value={persons}
                  onChange={setWho}
                  options={[
                    [1, <span key="1" className="whitespace-nowrap px-3">Für mich</span>],
                    [2, <span key="2" className="whitespace-nowrap px-3">Als Paar</span>],
                  ]}
                />
              )}
              {aged.length > 0 && (
                <label htmlFor="abo-year" className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2 @min-[640px]:ml-auto">
                  Jahrgang
                  <input
                    id="abo-year"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1985"
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                    className={`${input} @min-[640px]:w-32`}
                  />
                </label>
              )}
            </div>
            {aged.length > 0 && year && (
              <output htmlFor="abo-year" className="text-[14px] font-semibold text-brand-deep">
                {fitCat ? `Passt zu dir: ${fitCat}${proofTip ? ` (mit Ausweis: ${catOf(proofTip)})` : ""}` : "Jahrgang eingeben"}
              </output>
            )}
            {anchor && <div className="text-[14px] leading-[1.45] text-ink-2">{anchor}</div>}
          </div>

          {loggedIn && persons === 2 && partnerForm}

          {mains.length > 0 && (
            <section aria-label="Haupttarife" className={`grid items-stretch gap-4 @min-[640px]:grid-cols-2 ${gridCols}`}>
              {mains.map((p) => {
                const fit = fitCat === catOf(p);
                const last = membership?.planId === p.id;
                return (
                  <article key={p.id} className={`card flex flex-col gap-4 p-6 ${fit ? "outline-2 outline-offset-0 outline-brand-deep" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[22px] font-bold tracking-[-.02em]">{catOf(p)}</h2>
                      {fit && <span className="pill bg-brand-soft text-brand-deep">passt zu dir</span>}
                      {last && !fit && <span className="pill bg-bg text-ink-2">dein letztes Abo</span>}
                      {p === hlPlan && !fit && !last && <span className="pill bg-brand-soft text-brand-deep">am beliebtesten</span>}
                    </div>
                    {condition(p) && <div className="-mt-2 text-[13.5px] font-medium text-ink-2">{condition(p)}</div>}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[18px] font-medium text-ink-2">CHF</span>
                        <span className="text-[48px] font-bold leading-none tracking-[-.04em]">{fmt(p.price)}</span>
                        <span className="text-[15px] font-medium text-ink-2">pro Saison</span>
                      </div>
                      <div className="mt-1.5 min-h-5 text-[13.5px] text-ink-2">{sub(p)}</div>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {features(p).map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[14.5px] font-medium">
                          <Check />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto">{payButtons(p, p === hlPlan || fit)}</div>
                  </article>
                );
              })}
            </section>
          )}

          {rest.length > 0 && (
            <div className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[17px] font-bold">Weitere Tarife</h2>
                <span className="text-[13px] text-ink-2">Ermässigungen mit Alters- oder Ausweis-Nachweis</span>
              </div>
              <ul className="mt-2 divide-y divide-line @min-[1024px]:grid @min-[1024px]:grid-cols-2 @min-[1024px]:gap-x-8 @min-[1024px]:divide-y-0">
                {rest.map((p) => {
                  const on = p === sp;
                  return (
                    <li key={p.id} className="border-line @min-[1024px]:border-b">
                      <button type="button" aria-pressed={on} onClick={() => setSel(p.id)} className="flex w-full items-center gap-3 py-3.5 text-left">
                        <span className="min-w-0 flex-1">
                          <b className="block text-[15.5px]">{catOf(p)}</b>
                          {condition(p) && <small className="block text-[13px] text-ink-2">{condition(p)}</small>}
                          {fitCat === catOf(p) && <small className="font-semibold text-brand-deep">passt zu dir</small>}
                        </span>
                        <b className="text-[16px]">CHF {fmt(p.price)}</b>
                        <span className={`pill ${on ? "bg-brand-deep text-white" : "bg-bg text-ink-2"}`}>{on ? "Ausgewählt" : "Wählen"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid gap-4 @min-[1024px]:grid-cols-3">
            <div className="card p-5">
              <b className="block text-[15px]">Sofort freigeschaltet</b>
              <div className="mt-1 text-[14px] leading-[1.45] text-ink-2">Nach der Zahlung buchst du direkt. Keine Woche warten.</div>
            </div>
            <div className="card p-5">
              <b className="block text-[15px]">Gültig bis 31. März {seasonYear}</b>
              <div className="mt-1 text-[14px] leading-[1.45] text-ink-2">Die Saison läuft vom 1. April bis 31. März. Vor Ablauf bekommst du eine Erinnerung per E-Mail.</div>
            </div>
            <div className="card p-5">
              {dinerLabel ? (
                <>
                  <b className="block text-[15px]">Diner Tennis</b>
                  <div className="mt-1 text-[14px] leading-[1.45] text-ink-2">{dinerLabel} spielt dein Gast gratis, wenn ihr danach im Club zu Mittag esst.</div>
                </>
              ) : (
                <>
                  <b className="block text-[15px]">Gäste willkommen</b>
                  <div className="mt-1 text-[14px] leading-[1.45] text-ink-2">Nichtmitglieder zahlen nur ihren Anteil am Platz, zu zweit CHF {fmt(guestRate / 2)}.</div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {restSelected && sp.price > 0 && (
        <div className="card sticky bottom-[calc(max(10px,env(safe-area-inset-bottom))+76px)] z-20 flex flex-col gap-2 p-3 shadow-[var(--sh-lg)] @min-[640px]:bottom-4">
          <div className="px-1 text-[13px] font-semibold text-ink-2">
            {catOf(sp)}, CHF {fmt(sp.price)} pro Saison
          </div>
          {payButtons(sp, true)}
        </div>
      )}
    </div>
  );
}
