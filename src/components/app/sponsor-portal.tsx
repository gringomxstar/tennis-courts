"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DISCOUNT, chf, yearlyAmount } from "@/lib/sponsoring";
import { portalConfirmAction, portalConfirmLogoAction, portalDeclineAction, portalLogoAction } from "@/app/actions/sponsoring";

export type PortalItem = {
  id: string; name: string; description: string | null; price: number; hasImage: boolean;
  free: number | null; exclusive: boolean; hint: { text: string; tone: "sold" | "low" | "badge" } | null;
};
type Line = { itemId: string; name: string; quantity: number; price: number };

const HINT = { sold: "bg-bad-bg text-bad", low: "bg-warn-bg text-warn", badge: "bg-brand-tint text-brand-deep" };

export function SponsorPortal(p: {
  token: string; clubName: string; clubLogo?: string | null; sponsorName: string; year: number;
  state: "open" | "confirmed" | "declined"; items: PortalItem[]; prev: Line[];
  current: { lines: Line[]; years: number; startYear: number; discountPct: number; amount: number } | null;
  invoices: { id: string; number: number; year: number; amount: number; paid: boolean }[];
  logo: { type: string; confirmed: boolean; v: number } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [years, setYears] = useState(1);
  const [custom, setCustom] = useState(p.prev.length === 0);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(p.prev.map((l) => [l.itemId, l.quantity])));
  const byId = useMemo(() => new Map(p.items.map((i) => [i.id, i])), [p.items]);
  // last year's choice still bookable as is?
  const prevBlocked = p.prev.filter((l) => { const it = byId.get(l.itemId); return !it || (it.free != null && it.free < l.quantity); });

  const chosen = Object.entries(qty).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity }));
  const total = (ls: { itemId: string; quantity: number }[], y: number) =>
    yearlyAmount(ls.map((l) => ({ quantity: l.quantity, unitPrice: byId.get(l.itemId)?.price ?? 0 })), DISCOUNT[y]);

  function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    start(async () => {
      const r = await fn().catch(() => ({ success: false, error: "Verbindung fehlgeschlagen. Bitte nochmals versuchen." }));
      if (!r.success) return void toast.error(r.error ?? "Fehler");
      toast.success(ok);
      router.refresh();
    });
  }
  const confirm = (ls: { itemId: string; quantity: number }[]) =>
    run(() => portalConfirmAction(p.token, ls, years), "Danke! Ihre Zusage ist bestätigt, die Rechnung kommt per E-Mail.");

  return (
    <main className="mx-auto min-h-[100dvh] max-w-[680px] bg-background px-4 pb-40 pt-8 text-foreground sm:px-6">
      <header className="flex items-center gap-3">
        {p.clubLogo && <img src={p.clubLogo} alt="" className="h-11 w-11 rounded-full object-cover" />}
        <div className="text-[14px] font-semibold text-ink-2">{p.clubName}</div>
      </header>
      <h1 className="mt-5 text-[32px] font-bold leading-[1.1] tracking-[-.035em]">Sponsoring {p.year}</h1>
      <p className="mt-1 text-[16px] text-ink-2">{p.sponsorName}</p>

      {p.state === "confirmed" && p.current && (
        <section className="card mt-6 p-5">
          <div className="inline-flex rounded-full bg-ok-bg px-3 py-1 text-[13px] font-bold text-ok">Zugesagt</div>
          <h2 className="mt-3 text-[20px] font-bold tracking-[-.02em]">Danke für Ihre Unterstützung!</h2>
          <p className="mt-1 text-[14.5px] text-ink-2">
            {p.current.years > 1
              ? `Ihr Vertrag läuft ${p.current.startYear}–${p.current.startYear + p.current.years - 1} und verlängert sich jedes Jahr ohne neue Anfrage.`
              : `Ihre Wahl ${p.year} ist bestätigt.`}
          </p>
          <Lines lines={p.current.lines} />
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-[15px] font-bold">
            <span>Pro Jahr{p.current.discountPct ? ` (−${p.current.discountPct} %)` : ""}</span>
            <span className="tabular-nums">{chf(p.current.amount)}</span>
          </div>
        </section>
      )}

      {p.state === "declined" && (
        <section className="card mt-6 p-5">
          <h2 className="text-[18px] font-bold">Schade, dass Sie {p.year} nicht dabei sind.</h2>
          <p className="mt-1 text-[14.5px] text-ink-2">Falls Sie es sich anders überlegen, können Sie unten jederzeit noch zusagen.</p>
        </section>
      )}

      {p.state !== "confirmed" && (
        <>
          <Duration years={years} setYears={setYears} />

          {p.prev.length > 0 && !custom && (
            <section className="card mt-4 p-5">
              <div className="text-[13px] font-bold uppercase tracking-[.06em] text-ink-3">Ihre Wahl {p.year - 1}</div>
              <Lines lines={p.prev} />
              {prevBlocked.length > 0 ? (
                <p className="mt-3 rounded-[14px] bg-warn-bg p-3 text-[14px] text-warn">
                  {prevBlocked.map((l) => l.name).join(", ")} {prevBlocked.length > 1 ? "sind" : "ist"} {p.year} bereits vergeben. Bitte wählen Sie eine Alternative.
                </p>
              ) : (
                <button type="button" disabled={pending} onClick={() => confirm(p.prev)} className="btn btn-pri mt-4 h-[54px] w-full text-[16px]">
                  {pending ? "Wird bestätigt …" : `Für ${p.year}${years > 1 ? `–${p.year + years - 1}` : ""} verlängern · ${chf(total(p.prev, years))}${years > 1 ? "/Jahr" : ""}`}
                </button>
              )}
              <button type="button" onClick={() => setCustom(true)} className="mt-3 w-full text-center text-[14.5px] font-semibold text-brand-deep">
                Andere Leistungen wählen
              </button>
            </section>
          )}

          {(custom || p.prev.length === 0) && (
            <section className="mt-6">
              <h2 className="text-[20px] font-bold tracking-[-.02em]">Leistungen {p.year}</h2>
              <ul className="mt-3 grid gap-3">
                {p.items.map((it) => {
                  const q = qty[it.id] ?? 0;
                  const max = it.free ?? 20;
                  const sold = max === 0;
                  return (
                    <li key={it.id} className={cn("card flex gap-4 p-4", sold && "opacity-60")}>
                      {it.hasImage ? (
                        <img src={`/sponsor/bild/${it.id}`} alt="" className="h-20 w-20 flex-none rounded-[14px] bg-bg object-cover" />
                      ) : (
                        <div aria-hidden className="h-20 w-20 flex-none rounded-[14px] bg-brand-tint" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="text-[16px]">{it.name}</b>
                          {it.hint && <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", HINT[it.hint.tone])}>{it.hint.text}</span>}
                        </div>
                        {it.description && <p className="mt-0.5 text-[13.5px] text-ink-2">{it.description}</p>}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[15px] font-bold tabular-nums">{chf(it.price)}<span className="font-normal text-ink-3"> / Jahr</span></span>
                          {!sold && (it.exclusive || max === 1 ? (
                            <button type="button" aria-pressed={q > 0} onClick={() => setQty({ ...qty, [it.id]: q ? 0 : 1 })} className={cn("btn h-9 px-4", q ? "btn-pri" : "btn-ghost")}>
                              {q ? "Gewählt ✓" : "Wählen"}
                            </button>
                          ) : (
                            <span className="flex items-center gap-1">
                              <button type="button" aria-label={`${it.name} weniger`} disabled={!q} onClick={() => setQty({ ...qty, [it.id]: q - 1 })} className="btn btn-ghost h-9 w-9 px-0 text-[18px]">−</button>
                              <span className="w-7 text-center text-[16px] font-bold tabular-nums" aria-live="polite">{q}</span>
                              <button type="button" aria-label={`${it.name} mehr`} disabled={q >= max} onClick={() => setQty({ ...qty, [it.id]: q + 1 })} className="btn btn-ghost h-9 w-9 px-0 text-[18px]">+</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {chosen.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
                  <div className="mx-auto flex max-w-[680px] items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-ink-3">{years > 1 ? `${years} Jahre, −${DISCOUNT[years]} %` : "1 Jahr"}</div>
                      <div className="text-[19px] font-bold tabular-nums">{chf(total(chosen, years))}<span className="text-[13px] font-normal text-ink-3"> / Jahr</span></div>
                    </div>
                    <button type="button" disabled={pending} onClick={() => confirm(chosen)} className="btn btn-pri h-[50px] px-6 text-[15.5px]">
                      {pending ? "…" : "Verbindlich zusagen"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {p.state === "open" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => window.confirm(`${p.year} nicht mitmachen? Wir erinnern Sie dann nicht mehr.`) && run(() => portalDeclineAction(p.token), "Ihre Absage ist bei uns angekommen. Danke für die Rückmeldung.")}
              className="mt-6 w-full text-center text-[14px] font-semibold text-ink-3 underline underline-offset-4"
            >
              Dieses Jahr nicht dabei
            </button>
          )}
        </>
      )}

      <LogoCard token={p.token} logo={p.logo} pending={pending} run={run} />

      {p.invoices.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="text-[17px] font-bold">Rechnungen</h2>
          <ul className="mt-2 divide-y divide-line">
            {p.invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-[14.5px]">
                <a href={`/sponsor/${p.token}/rechnung/${i.id}`} className="font-semibold text-brand-deep">Nr. {i.number} · {i.year}</a>
                <span className="flex items-center gap-2 tabular-nums">
                  {chf(i.amount)}
                  <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", i.paid ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn")}>{i.paid ? "bezahlt" : "offen"}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-center text-[12.5px] text-ink-3">Persönlicher Link für {p.sponsorName}. Bitte nicht weitergeben.</p>
    </main>
  );
}

function Duration({ years, setYears }: { years: number; setYears: (y: number) => void }) {
  return (
    <fieldset className="mt-6">
      <legend className="text-[13px] font-bold uppercase tracking-[.06em] text-ink-3">Laufzeit</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((y) => (
          <button key={y} type="button" aria-pressed={years === y} onClick={() => setYears(y)}
            className={cn("rounded-[16px] px-2 py-3 text-center shadow-card", years === y ? "bg-ink text-card" : "bg-card text-ink")}>
            <div className="text-[16px] font-bold">{y} {y === 1 ? "Jahr" : "Jahre"}</div>
            <div className={cn("text-[12.5px]", years === y ? "opacity-80" : "text-ink-3")}>{DISCOUNT[y] ? `−${DISCOUNT[y]} %` : "Standard"}</div>
          </button>
        ))}
      </div>
      {years > 1 && <p className="mt-2 text-[13px] text-ink-2">Der Vertrag verlängert sich jedes Jahr ohne neue Anfrage. Sie erhalten jährlich eine Rechnung.</p>}
    </fieldset>
  );
}

function Lines({ lines }: { lines: Line[] }) {
  return (
    <ul className="mt-3 grid gap-1.5">
      {lines.map((l) => (
        <li key={l.itemId} className="flex justify-between gap-3 text-[15px]">
          <span>{l.quantity > 1 ? `${l.quantity}× ` : ""}{l.name}</span>
          <span className="tabular-nums text-ink-2">{chf(l.quantity * l.price)}</span>
        </li>
      ))}
    </ul>
  );
}

function LogoCard({ token, logo, pending, run }: {
  token: string; logo: { type: string; confirmed: boolean; v: number } | null; pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void;
}) {
  const isImage = logo?.type.startsWith("image/");
  return (
    <section className="card mt-6 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold">Ihr Logo</h2>
        {logo && <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", logo.confirmed ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn")}>{logo.confirmed ? "bestätigt" : "noch nicht bestätigt"}</span>}
      </div>
      <p className="mt-1 text-[14px] text-ink-2">Für Blache, Tischset und Website. Am besten SVG oder PDF (Vektor), sonst PNG in hoher Auflösung. Max. 3 MB.</p>
      {logo && (
        <div className="mt-3 flex items-center gap-4 rounded-[16px] bg-white p-4">
          {isImage ? <img src={`/sponsor/${token}/logo?v=${logo.v}`} alt="Ihr Logo" className="max-h-24 max-w-[60%] object-contain" /> : <span className="text-[14px] text-ink-2">PDF hochgeladen</span>}
          <a href={`/sponsor/${token}/logo?download`} className="ml-auto text-[13.5px] font-semibold text-brand-deep">Ansehen</a>
        </div>
      )}
      <label className="btn btn-ghost mt-3 w-full cursor-pointer">
        {logo ? "Anderes Logo hochladen" : "Logo hochladen"}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf" className="sr-only" disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const fd = new FormData();
            fd.set("logo", f);
            run(() => portalLogoAction(token, fd), "Logo hochgeladen. Bitte prüfen und bestätigen.");
          }} />
      </label>
      {logo && !logo.confirmed && (
        <button type="button" disabled={pending} onClick={() => run(() => portalConfirmLogoAction(token), "Danke, Logo bestätigt.")} className="btn btn-pri mt-2 w-full">
          Logo so verwenden
        </button>
      )}
    </section>
  );
}
