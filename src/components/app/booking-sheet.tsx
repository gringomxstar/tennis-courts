"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/app/sheet";
import { Dot, Spinner } from "@/components/app/avatar";
import { Segmented } from "@/components/app/segmented";
import { createBookingAction } from "@/app/actions/booking";
import { computeBookingCost, isDinerSlot, needsFloodlight, payButtonLabel, payOptions, roundRappen } from "@/lib/pricing";
import { courtColor, courtLabel, hh, initials, longDate } from "@/lib/courts";
import type { Person } from "@/lib/partners";
import type { Court, PaymentMethod, TenantSettings, SportType } from "@/types";
import { cn } from "@/lib/utils";

export interface SheetSlot {
  court: Court;
  start: Date;
}

const inputCls =
  "h-[50px] w-full rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground";

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
  const color = s ? courtColor(s.court) : "var(--tennis-clay)";
  const label = s ? courtLabel(s.court) : { name: "", sub: "" };
  const base = cost ? cost.total - cost.lighting : 0;

  const total = cost?.total ?? 0;
  const guestName = coGuest?.trim() ?? "";
  const missingPartner = needPartner && !players.length && !guestName;
  const opts = payOptions(settings, { isAnon, wallet, total });
  const pay = method && opts.some(([m]) => m === method) ? method : opts[0][0];
  const btnLabel = phase === "paying" ? "Einen Moment…" : total > 0 ? payButtonLabel(pay, total) : "Buchen";

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
      ...(total > 0 ? { paymentMethod: pay } : {}),
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
  }

  const reserveHref = s
    ? `/c/${slug}/reserve?court=${encodeURIComponent(s.court.id)}&start=${encodeURIComponent(s.start.toISOString())}${players.length ? `&players=${players.join(",")}` : ""}`
    : "#";

  return (
    <Sheet open={Boolean(slot)} onOpenChange={(o) => !o && onClose()} title="Platz buchen">
      {s && phase !== "done" && (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[15px] font-semibold text-muted-foreground">{longDate(s.start)}</div>
              <div className="text-[64px] font-bold leading-none tracking-[-.055em]">{hh(s.start.getHours())}</div>
            </div>
            <div className="pb-1.5 text-right">
              <div className="flex items-center justify-end gap-[7px] text-[18px] font-bold">
                <Dot color={color} size={9} />
                {label.name}
              </div>
              <div className="text-[14px] text-muted-foreground">{label.sub} · 60 Min</div>
            </div>
          </div>

          {isAnon ? (
            <>
              <div className="mt-6 text-[14px] font-bold uppercase tracking-[.06em] text-muted-foreground">Deine Angaben</div>
              <div className="mt-2.5 flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                  <input aria-label="Vorname" placeholder="Vorname" autoComplete="given-name" className={inputCls} value={guest.first} onChange={(e) => setGuest({ ...guest, first: e.target.value })} />
                  <input aria-label="Nachname" placeholder="Nachname" autoComplete="family-name" className={inputCls} value={guest.last} onChange={(e) => setGuest({ ...guest, last: e.target.value })} />
                </div>
                <input aria-label="E-Mail" type="email" placeholder="E-Mail" autoComplete="email" className={inputCls} value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 text-[14px] font-bold uppercase tracking-[.06em] text-muted-foreground">Mitspieler</div>
              <div className="no-scrollbar -mx-1 mt-1.5 flex gap-3 overflow-x-auto px-1 py-1">
                {pool.map((p) => {
                  const on = players.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={p.name}
                      onClick={() => setPlayers(on ? players.filter((x) => x !== p.id) : [...players, p.id])}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span
                        className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-full text-[17px] font-bold transition-all duration-[350ms] ease-spring",
                          on ? "scale-[1.08] bg-clay text-white" : "bg-acc text-foreground"
                        )}
                        style={{ boxShadow: on ? "0 0 0 3px var(--sheet), 0 0 0 5px var(--tennis-clay)" : "none" }}
                      >
                        {initials(p.name)}
                      </span>
                      <span className="text-[14px] font-semibold text-muted-foreground">{p.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={coGuest !== null}
                  aria-label="Gast hinzufügen"
                  onClick={() => setCoGuest(coGuest === null ? "" : null)}
                  className="flex shrink-0 flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed text-[24px] font-bold transition-all duration-[350ms] ease-spring",
                      coGuest !== null ? "scale-[1.08] border-clay bg-clay text-white" : "border-border text-muted-foreground"
                    )}
                  >
                    +
                  </span>
                  <span className="text-[14px] font-semibold text-muted-foreground">Gast</span>
                </button>
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
                  <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
                    {guestAdds > 0 ? `+ CHF ${guestAdds.toFixed(2)}` : "gratis"}
                  </span>
                </div>
              )}
              <Link
                href={reserveHref}
                className="mt-4 flex h-[50px] w-full items-center justify-between rounded-[15px] border border-border px-4 transition-transform active:scale-[.98]"
              >
                <span className="text-left">
                  <span className="block text-[16px] font-bold">Mehr Optionen</span>
                  <span className="block text-[14px] text-muted-foreground">Doppel · Gäste · 2 Stunden · Ballmaschine</span>
                </span>
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            </>
          )}

          <div className="mt-3.5 rounded-[20px] bg-inset px-[18px] py-4">
            {cost && cost.lighting > 0 && (
              <div className="flex justify-between pb-2 text-[16px] font-semibold">
                <span>Flutlicht</span>
                <span>CHF {cost?.lighting}</span>
              </div>
            )}
            <div className="flex justify-between text-[16px] font-semibold">
              <span>{cost && cost.payers > 0 && onCourt.length + (coGuest !== null ? 1 : 0) > 1 ? `Platz (${cost.payers} × CHF ${cost.share.toFixed(2)})` : "Platz"}</span>
              <span>{base > 0 ? `CHF ${base}` : "im Abo inklusive"}</span>
            </div>
          </div>
          {!isAnon && !guestRate && planSports && isDinerSlot(settings, s?.start) && (
            <Link href={reserveHref} className="mt-2 block text-center text-[14px] text-muted-foreground">
              Diner Tennis: Gast gratis mitnehmen – <span className="font-semibold text-clay-text">Gast hinzufügen</span>
            </Link>
          )}
          {isAnon && (
            <Link href={`/c/${slug}/abos`} className="mt-2 block text-center text-[14px] text-muted-foreground">
              Mit Abo: Sandplätze ohne Platzgebühr – <span className="font-semibold text-clay-text">Abos ansehen</span>
            </Link>
          )}

          {total > 0 && opts.length > 1 && (
            <Segmented className="mt-3" label="Zahlungsart" value={pay} onChange={setMethod} options={opts} />
          )}

          {missingPartner && (
            <div className="mt-4 text-center text-[14px] text-muted-foreground">Mit wem spielst du? Wähle einen Mitspieler oder einen Gast.</div>
          )}
          <button
            type="button"
            onClick={confirm}
            disabled={phase !== "form" || missingPartner}
            className="mt-4 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[20px] text-[18px] font-bold text-white transition-transform active:scale-[.97] disabled:opacity-50 disabled:active:scale-100"
            style={{ background: color, boxShadow: `0 14px 30px -10px ${color}` }}
          >
            {phase === "paying" && <Spinner />}
            {btnLabel}
          </button>
        </>
      )}
      {s && phase === "done" && (
        <div role="status" className="flex flex-col items-center gap-3.5 pb-2.5 pt-[30px]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-clay animate-[pop_.6s_var(--ease-spring)]">
            <svg aria-hidden width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <div className="text-[28px] font-bold tracking-[-.03em]">Gebucht.</div>
          <div className="text-[16px] text-muted-foreground">
            {longDate(s.start)} · {hh(s.start.getHours())} · {label.name}
          </div>
          <button type="button" onClick={onClose} className="mt-3 flex h-14 w-full items-center justify-center rounded-[20px] bg-clay text-[18px] font-bold text-white active:scale-[.97]">
            Fertig
          </button>
          <Link href={`/c/${slug}/calendar`} className="flex min-h-11 items-center text-[14px] font-semibold text-clay-text">
            Im Kalender ansehen
          </Link>
        </div>
      )}
    </Sheet>
  );
}
