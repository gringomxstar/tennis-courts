"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/app/sheet";
import { Dot, Spinner } from "@/components/app/avatar";
import { Segmented } from "@/components/app/segmented";
import { createBookingAction } from "@/app/actions/booking";
import { computeBookingCost, needsFloodlight, payButtonLabel, payOptions } from "@/lib/pricing";
import { courtColor, courtLabel, hh, initials, longDate } from "@/lib/courts";
import type { Person } from "@/lib/partners";
import type { Court, PaymentMethod, TenantSettings } from "@/types";
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
  wallet = 0,
}: {
  slug: string;
  settings: TenantSettings | null | undefined;
  slot: SheetSlot | null;
  onClose: () => void;
  pool: Person[];
  isAnon: boolean;
  /** Logged-in GUEST accounts without Abo also pay the guest court rate. */
  guestRate?: boolean;
  wallet?: number;
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<string[]>([]);
  const [phase, setPhase] = useState<"form" | "paying" | "done">("form");
  const [guest, setGuest] = useState({ first: "", last: "", email: "" });
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  // keep the last slot so the closing animation still shows its content
  const [shown, setShown] = useState<SheetSlot | null>(slot);
  if (slot && slot !== shown) {
    setShown(slot);
    setPlayers([]);
    setPhase("form");
    setMethod(null);
  }

  const s = shown;
  const light = s ? needsFloodlight(s.court, s.start.getHours()) : false;
  const cost = s
    ? computeBookingCost({
        settings,
        court: s.court,
        isGuest: guestRate,
        durationMinutes: 60,
        guestCount: 0,
        hasBallMachine: false,
        hasLighting: light,
        start: s.start,
      })
    : null;
  const color = s ? courtColor(s.court) : "var(--tennis-clay)";
  const label = s ? courtLabel(s.court) : { name: "", sub: "" };
  const base = cost ? cost.total - cost.lighting : 0;

  const total = cost?.total ?? 0;
  const opts = payOptions(settings, { isAnon, wallet, total });
  const pay = method && opts.some(([m]) => m === method) ? method : opts[0][0];
  const btnLabel = phase === "paying" ? "Einen Moment…" : total > 0 ? payButtonLabel(pay, total) : "Buchen";

  async function confirm() {
    if (!s || phase !== "form") return;
    setPhase("paying");
    const res = await createBookingAction({
      clubSlug: slug,
      courtId: s.court.id,
      startsAt: s.start.toISOString(),
      durationMinutes: 60,
      matchType: players.length >= 3 ? "DOUBLE" : "SINGLE",
      participants: players.map((userId) => ({ type: "MEMBER" as const, userId })),
      hasLighting: light,
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
    setTimeout(onClose, 1500);
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
              <div className="mt-6 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">Deine Angaben</div>
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
              <div className="mt-6 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">Mitspieler</div>
              <div className="mt-2.5 flex gap-3">
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
                      <span className="text-[13px] font-semibold text-muted-foreground">{p.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
              <Link href={reserveHref} className="mt-3.5 flex items-center justify-center gap-1.5 text-[15px] font-semibold text-clay-text">
                Mitglieder, Doppel &amp; mehr Optionen
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            </>
          )}

          <div className="mt-3.5 rounded-[20px] bg-inset px-[18px] py-4">
            {light && (
              <div className="flex justify-between pb-2 text-[16px] font-semibold">
                <span>Flutlicht</span>
                <span>CHF {cost?.lighting}</span>
              </div>
            )}
            <div className="flex justify-between text-[16px] font-semibold">
              <span>{isAnon ? "Platz + Gastgebühr" : "Platz"}</span>
              <span>{base > 0 ? `CHF ${base}` : "im Abo inklusive"}</span>
            </div>
          </div>
          {isAnon && (
            <Link href={`/c/${slug}/abos`} className="mt-2 block text-center text-[13px] text-muted-foreground">
              Mit Abo: Sandplätze ohne Platzgebühr – <span className="font-semibold text-clay-text">Abos ansehen</span>
            </Link>
          )}

          {total > 0 && opts.length > 1 && (
            <Segmented className="mt-3" label="Zahlungsart" value={pay} onChange={setMethod} options={opts} />
          )}

          <button
            type="button"
            onClick={confirm}
            disabled={phase !== "form"}
            className="mt-4 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[20px] text-[18px] font-bold text-white transition-transform active:scale-[.97]"
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
        </div>
      )}
    </Sheet>
  );
}
