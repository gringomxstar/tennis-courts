"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/app/sheet";
import { avatarBg, Dot, Spinner } from "@/components/app/avatar";
import { Segmented } from "@/components/app/segmented";
import { createBookingAction } from "@/app/actions/booking";
import { aboCovers, computeBookingCost, isDinerSlot, needsFloodlight, payButtonLabel, payOptions, roundRappen, type BookingCost } from "@/lib/pricing";
import { courtColor, courtLabel, hh, initials, longDate } from "@/lib/courts";
import type { Person } from "@/lib/partners";
import type { Court, PaymentMethod, TenantSettings, SportType } from "@/types";

export interface SheetSlot {
  court: Court;
  start: Date;
}

const inputCls =
  "h-12 w-full rounded-[14px] bg-bg px-4 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--brand-deep)]";

const chf = (n: number) => `CHF ${n % 1 ? n.toFixed(2) : n}`;

/**
 * v3 price split: every player on court with their share; an Abo covers only its holder's share,
 * the booker pays the rest. `people[0]` is the booker.
 */
export function PriceSplit({
  court,
  cost,
  people,
  hint,
}: {
  court: Pick<Court, "isIndoor" | "sportType">;
  cost: BookingCost;
  people: { name: string; sports: SportType[] | null; guest?: boolean }[];
  hint?: string;
}) {
  // Diner Tennis lets partners without Abo play free; computeBookingCost already counts them out
  let free = people.filter((p) => !aboCovers(court, p.sports)).length - cost.payers;
  const rows = people.map((p, i) => {
    const who = i === 0 ? "Du" : p.name.split(" ")[0];
    if (aboCovers(court, p.sports)) return [`${who}, Abo deckt ${i === 0 ? "deinen" : "den"} Anteil`, 0] as const;
    if (i > 0 && free > 0) {
      free--;
      return [`${who}, Diner Tennis`, 0] as const;
    }
    return [`${who}, ${p.guest ? "Gast" : "kein Abo"}`, cost.share] as const;
  });
  return (
    <div className="sum">
      {people.length > 1 || cost.court === 0
        ? rows.map(([l, n], i) => (
            <div key={i} className="contents">
              <span>{l}</span>
              <b className="font-semibold">{chf(n)}</b>
            </div>
          ))
        : (
            <>
              <span>Platz</span>
              <b className="font-semibold">{chf(cost.court)}</b>
            </>
          )}
      {cost.lighting > 0 && (
        <>
          <span>Flutlicht</span>
          <b className="font-semibold">{chf(cost.lighting)}</b>
        </>
      )}
      {cost.ballMachine > 0 && (
        <>
          <span>Ballmaschine</span>
          <b className="font-semibold">{chf(cost.ballMachine)}</b>
        </>
      )}
      <span className="border-t border-[#d5dfdb] pt-2 text-[16px] font-bold">Du bezahlst</span>
      <b className="border-t border-[#d5dfdb] pt-2 text-[16px] font-bold">{cost.total > 0 ? chf(cost.total) : "inbegriffen"}</b>
      <span className="col-span-2 text-[12.5px] text-ink-3">
        {people.length > 1 && "Ein Abo deckt nur den eigenen Anteil. Den Rest bezahlt, wer bucht. "}
        {hint}
      </span>
    </div>
  );
}

/** What happens with the money, next to the price split (the server applies the same rule). */
export function payHint(method: PaymentMethod, total: number, wallet: number) {
  if (total <= 0) return undefined;
  if (method === "WALLET") return `Wird von deinem Guthaben abgebucht (${chf(wallet)} verfügbar).`;
  if (method === "ONLINE") return "Twint oder Karte im nächsten Schritt.";
  return method === "ON_SITE" ? "Du bezahlst vor Ort." : "Kommt auf die Rechnung.";
}

export function BookingSheet({
  slug,
  settings,
  slot,
  onClose,
  pool,
  isAnon,
  guestRate = isAnon,
  planSports = null,
  wallet = 0,
  needPartner = false,
}: {
  slug: string;
  settings: TenantSettings | null | undefined;
  slot: SheetSlot | null;
  onClose: () => void;
  pool: Person[];
  isAnon: boolean;
  /** Logged-in GUEST accounts without Abo also pay the guest court rate. */
  guestRate?: boolean;
  planSports?: SportType[] | null;
  wallet?: number;
  /** Members must pick a co-player or add a guest before booking. */
  needPartner?: boolean;
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<string[]>([]);
  const [phase, setPhase] = useState<"form" | "paying" | "done">("form");
  const [guest, setGuest] = useState({ first: "", last: "", email: "" });
  // co-player guest (logged-in members); null = no guest row
  const [coGuest, setCoGuest] = useState<string | null>(null);
  // only the club's extra methods (vor Ort, Rechnung) are a choice; wallet vs. Stripe is decided by the rule
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  // keep the last slot so the closing animation still shows its content
  const [shown, setShown] = useState<SheetSlot | null>(slot);
  if (slot && slot !== shown) {
    setShown(slot);
    setPlayers([]);
    setCoGuest(null);
    setPhase("form");
    setMethod(null);
  }

  const s = shown;
  const light = s ? needsFloodlight(s.court, s.start, 60) : false;
  const onCourt = [planSports, ...players.map((id) => pool.find((p) => p.id === id)?.sports ?? null)];
  const costFor = (guests: number) =>
    s ? computeBookingCost({ settings, court: s.court, players: [...onCourt, ...Array<null>(guests).fill(null)], durationMinutes: 60, hasBallMachine: false, hasLighting: light, start: s.start }) : null;
  const cost = costFor(coGuest !== null ? 1 : 0);
  // the guest's effect on the price: the shares change for everyone
  const guestAdds = roundRappen((costFor(1)?.total ?? 0) - (costFor(0)?.total ?? 0));
  const color = s ? courtColor(s.court) : "var(--brand)";
  const label = s ? courtLabel(s.court) : { name: "", sub: "" };

  const total = cost?.total ?? 0;
  const guestName = coGuest?.trim() ?? "";
  const missingPartner = needPartner && !players.length && !guestName;
  const opts = payOptions(settings, { isAnon, wallet, total });
  const pay = method && opts.some(([m]) => m === method) ? method : opts[0][0];
  const btnLabel = phase === "paying" ? "Einen Moment…" : payButtonLabel(pay, total);
  const people = [
    { name: "Du", sports: isAnon ? null : planSports },
    ...players.map((id) => pool.find((p) => p.id === id)).map((p) => ({ name: p?.name ?? "", sports: p?.sports ?? null })),
    ...(coGuest !== null ? [{ name: guestName || "Gast", sports: null, guest: true }] : []),
  ];

  async function confirm() {
    if (!s || phase !== "form") return;
    if (missingPartner) return void toast("Bitte wähle einen Mitspieler oder füge einen Gast hinzu.");
    if (coGuest !== null && !guestName) return void toast("Bitte den Namen des Gasts angeben.");
    setPhase("paying");
    const res = await createBookingAction({
      clubSlug: slug,
      courtId: s.court.id,
      startsAt: s.start.toISOString(),
      durationMinutes: 60,
      matchType: players.length + (guestName ? 1 : 0) >= 3 ? "DOUBLE" : "SINGLE",
      participants: [
        ...players.map((userId) => ({ type: "MEMBER" as const, userId })),
        ...(guestName ? [{ type: "GUEST" as const, guestName }] : []),
      ],
      // wallet vs. Stripe is decided on the server; only the club's extra methods are sent
      ...(total > 0 && (pay === "ON_SITE" || pay === "INVOICE") ? { paymentMethod: pay } : {}),
      ...(isAnon ? { guestFirstName: guest.first, guestLastName: guest.last, guestEmail: guest.email } : {}),
    }).catch(() => ({ success: false as const, error: "Verbindung fehlgeschlagen. Bitte erneut versuchen." }));
    if (!res.success) {
      setPhase("form");
      toast(res.error ?? "Buchung fehlgeschlagen");
      return;
    }
    if ("checkoutUrl" in res && res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
      return;
    }
    if ("manageUrl" in res && res.manageUrl) {
      window.location.assign(res.manageUrl);
      return;
    }
    setPhase("done");
    router.refresh();
    setTimeout(onClose, 1500);
  }

  const reserveHref = s
    ? `/c/${slug}/reserve?court=${encodeURIComponent(s.court.id)}&start=${encodeURIComponent(s.start.toISOString())}${players.length ? `&players=${players.join(",")}` : ""}`
    : "#";

  return (
    <Sheet open={Boolean(slot)} onOpenChange={(o) => !o && onClose()} title="Reservieren">
      {s && phase !== "done" && (
        <>
          <div>
            <h2 className="text-[26px] font-bold leading-[1.1] tracking-[-.03em]">
              {longDate(s.start)}, {hh(s.start.getHours())}
            </h2>
            <div className="mt-1 flex items-center gap-[7px] text-[13.5px] text-ink-2">
              <Dot color={color} size={9} />
              {label.name}, {label.sub}, 1 Stunde
            </div>
          </div>

          {isAnon ? (
            <>
              <div className="mb-[7px] mt-4 text-[13px] font-semibold text-ink-2">Deine Angaben</div>
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                  <input aria-label="Vorname" placeholder="Vorname" autoComplete="given-name" className={inputCls} value={guest.first} onChange={(e) => setGuest({ ...guest, first: e.target.value })} />
                  <input aria-label="Nachname" placeholder="Nachname" autoComplete="family-name" className={inputCls} value={guest.last} onChange={(e) => setGuest({ ...guest, last: e.target.value })} />
                </div>
                <input aria-label="E-Mail" type="email" placeholder="E-Mail" autoComplete="email" className={inputCls} value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div className="mb-[7px] mt-4 text-[13px] font-semibold text-ink-2">Mitspieler</div>
              <div className="flex flex-wrap gap-[7px]">
                {pool.map((p) => {
                  const on = players.includes(p.id);
                  const ini = initials(p.name);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPlayers(on ? players.filter((x) => x !== p.id) : [...players, p.id])}
                      className="chip h-[38px] bg-bg pl-1 pr-3 shadow-none"
                    >
                      <span aria-hidden className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[10.5px] font-bold text-white" style={{ background: avatarBg(ini) }}>
                        {ini}
                      </span>
                      {p.name.split(" ")[0]}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={coGuest !== null} onClick={() => setCoGuest(coGuest === null ? "" : null)} className="chip h-[38px] bg-bg text-brand-deep shadow-none">
                  + Gast
                </button>
                <Link href={reserveHref} className="chip h-[38px] bg-bg text-brand-deep shadow-none">
                  + Mehr Optionen
                </Link>
              </div>
              {coGuest !== null && (
                <div className="mt-2.5 flex items-center gap-2.5">
                  <input
                    aria-label="Name des Gasts"
                    placeholder="Name des Gasts"
                    autoFocus
                    className={inputCls}
                    value={coGuest}
                    onChange={(e) => setCoGuest(e.target.value)}
                  />
                  <span className="shrink-0 text-[13.5px] font-semibold text-ink-2">
                    {guestAdds > 0 ? `+ CHF ${guestAdds.toFixed(2)}` : "gratis"}
                  </span>
                </div>
              )}
              {missingPartner && (
                <div className="mt-2 text-[13.5px] text-ink-3">Mit wem spielst du? Wähle einen Mitspieler oder einen Gast.</div>
              )}
            </>
          )}

          {cost && (
            <div className="mt-4">
              <PriceSplit court={s.court} cost={cost} people={people} hint={payHint(pay, total, wallet)} />
            </div>
          )}
          {!isAnon && !guestRate && planSports && isDinerSlot(settings, s?.start) && (
            <Link href={reserveHref} className="mt-2 block text-center text-[13.5px] text-ink-3">
              Diner Tennis: Gast gratis mitnehmen – <span className="font-semibold text-clay-text">Gast hinzufügen</span>
            </Link>
          )}
          {isAnon && (
            <Link href={`/c/${slug}/abos`} className="mt-2 block text-center text-[13.5px] text-ink-3">
              Mit Abo: Sandplätze ohne Platzgebühr – <span className="font-semibold text-clay-text">Abos ansehen</span>
            </Link>
          )}

          {total > 0 && opts.length > 1 && (
            // only when the club enabled "vor Ort" / "Rechnung"; wallet vs. Stripe is never a choice
            <Segmented className="mt-3" label="Zahlungsart" value={pay} onChange={setMethod} options={opts} />
          )}

          <button
            type="button"
            onClick={confirm}
            disabled={phase !== "form" || missingPartner}
            className="btn btn-pri mt-4 h-[50px] w-full flex-none text-[15.5px]"
          >
            {phase === "paying" && <Spinner />}
            {btnLabel}
          </button>
        </>
      )}
      {s && phase === "done" && (
        <div role="status" className="flex flex-col items-center gap-3.5 pb-2.5 pt-[30px]">
          <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-ok-bg text-ok animate-[pop_.6s_var(--ease-spring)]">
            <svg aria-hidden width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <div className="text-[26px] font-bold tracking-[-.03em]">{label.name} ist reserviert</div>
          <div className="text-[15px] text-ink-3">
            {longDate(s.start)} · {hh(s.start.getHours())} · {label.name}
          </div>
        </div>
      )}
    </Sheet>
  );
}
