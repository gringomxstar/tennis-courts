"use client";


import { useMemo, useState } from "react";
import Link from "next/link";
import { BookingSheet } from "@/components/app/booking-sheet";
import { Avatar, Dot } from "@/components/app/avatar";
import { useSheetSlot } from "@/components/app/use-sheet-slot";
import { useNow } from "@/components/app/use-now";
import {
  addDays,
  atHour,
  courtColor,
  courtLabel,
  hh,
  initials,
  longDate,
  relDay,
  slotState,
  startOfToday,
  SURFACE_LABEL,
  surfaceKind,
  WD,
  WDL,
} from "@/lib/courts";
import type { Person } from "@/lib/partners";
import type { Booking, Court, CourtBlock, Tenant, SportType } from "@/types";

const SURFACE_ORDER = { clay: 0, hard: 1, padel: 2 } as const;

export function HomeView({
  tenant,
  courts,
  bookings,
  blocks,
  myBookings,
  userId,
  firstName,
  partners,
  wallet,
  guestRate,
  needPartner = false,
  planSports,
  minPlanPrice,
  aboCta,
}: {
  tenant: Tenant;
  courts: Court[];
  bookings: Booking[];
  blocks: CourtBlock[];
  myBookings: Booking[];
  userId?: string;
  firstName?: string;
  partners: Person[];
  wallet: number;
  guestRate: boolean;
  needPartner?: boolean;
  planSports: SportType[] | null;
  minPlanPrice: number | null;
  /** Logged-in Abo prompt: no Abo yet, or the Abo ends within 30 days without renewal. */
  aboCta: "join" | "renew" | null;
}) {
  const sheet = useSheetSlot();
  const [heatDay, setHeatDay] = useState<0 | 1>(0);
  // local-time rendering only on the client, so server/client never disagree about "now"
  const now = useNow();
  const ready = now > 0;
  const settings = tenant.settingsJson;
  const open = settings?.openingHour ?? 7;
  const close = settings?.closingHour ?? 22;
  const byId = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);

  const data = useMemo(() => {
    if (!ready) return null;
    const upcoming = myBookings
      .filter((b) => new Date(b.endsAt).getTime() > now && byId.has(b.courtId))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const ordered = [...courts].sort(
      (a, b) => SURFACE_ORDER[surfaceKind(a)] - SURFACE_ORDER[surfaceKind(b)] || a.sortOrder - b.sortOrder
    );
    const quick: { court: Court; start: Date }[] = [];
    for (let d = 0; d < 3 && quick.length < 6; d++) {
      // today: from the next full hour ("Jetzt frei"); later days: evenings, when most people play
      const from = d === 0 ? Math.max(open, new Date(now).getHours() + 1) : Math.max(open, 17);
      for (let h = from; h <= close - 1 && quick.length < 6; h++) {
        const start = atHour(addDays(startOfToday(), d), h);
        const c = ordered.find((c) => slotState(c.id, start, 60, bookings, blocks, userId, now) === "free");
        if (c) quick.push({ court: c, start });
      }
    }

    // "Nochmal wie letzte Woche": the last past booking, same weekday/time/court, next free week
    const last = myBookings
      .filter((b) => new Date(b.startsAt).getTime() < now && byId.has(b.courtId))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
    let rebook: { court: Court; start: Date } | null = null;
    if (last) {
      const start = new Date(last.startsAt);
      while (start.getTime() < now) start.setDate(start.getDate() + 7);
      const court = byId.get(last.courtId)!;
      if (slotState(court.id, start, 60, bookings, blocks, userId, now) === "free") rebook = { court, start };
    }
    return { upcoming, quick, last, rebook, ordered };
  }, [ready, now, myBookings, courts, bookings, blocks, userId, byId, open, close]);

  const hour = new Date(now).getHours();
  const greet = hour < 11 ? "Guten Morgen," : hour < 18 ? "Guten Tag," : "Guten Abend,";
  const next = data?.upcoming[0];
  const counts = courts.reduce(
    (acc, c) => ({ ...acc, [surfaceKind(c)]: (acc[surfaceKind(c)] ?? 0) + 1 }),
    {} as Record<string, number>
  );
  const bookingsHref = `/c/${tenant.slug}/bookings`;
  const calendarHref = `/c/${tenant.slug}/calendar`;
  const aboHref = `/c/${tenant.slug}/abos`;
  const facts = [counts.clay && `${counts.clay} Sand`, counts.hard && `${counts.hard} Allwetter`, counts.padel && `${counts.padel} Padel`].filter(Boolean).join(", ");

  const range = (b: Booking) => {
    const s = new Date(b.startsAt), e = new Date(b.endsAt);
    const mins = (e.getTime() - s.getTime()) / 60_000;
    return hh(s.getHours()) + (mins > 60 ? "–" + hh(e.getHours()) : "");
  };
  const others = (b: Booking) =>
    b.participants
      .filter((p) => p.userId !== userId && p.role !== "ORGANIZER")
      .map((p) => (p.user ? `${p.user.firstName} ${p.user.lastName}`.trim() : p.guestName ?? ""))
      .filter(Boolean);
  const short = (n: string) => { const [f, ...r] = n.split(" "); return r.length ? `${f} ${r[r.length - 1][0]}.` : f; };
  const dayLabel = (d: Date) => `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;

  const slotCards = (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
      {data?.quick.map((q) => {
        const l = courtLabel(q.court);
        return (
          <button
            key={q.court.id + q.start.toISOString()}
            type="button"
            onClick={() => sheet.open(q)}
            aria-label={`${relDay(q.start)} ${hh(q.start.getHours())}, ${l.name} buchen`}
            className="card flex w-[128px] flex-none flex-col gap-0.5 px-4 py-3.5 text-left"
          >
            <small className="text-[12.5px] text-ink-3">{relDay(q.start)}</small>
            <b className="text-[32px] font-bold leading-[1.1] tracking-[-.04em]">{hh(q.start.getHours())}</b>
            <span className="flex items-center gap-1.5 font-semibold"><Dot color={courtColor(q.court)} />{l.name}</span>
            <small className="text-[12.5px] text-ink-3">{l.sub}</small>
          </button>
        );
      })}
    </div>
  );

  // ---- Einstieg: logged-out visitor, three buttons then "Jetzt frei" ----
  if (!userId) {
    const btn = "btn h-[54px] w-full text-[16px]";
    return (
      <>
        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4 px-5 pb-8 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2">
          <div className="flex items-center gap-2.5 text-[17px] font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
            {tenant.logoUrl ? <img src={tenant.logoUrl} alt="" className="h-[42px] w-[42px] object-contain" /> : <i className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] bg-brand-deep text-[13px] font-extrabold not-italic text-white">TC</i>}
            {tenant.name}
          </div>
          <div className="flex flex-col gap-3.5 rounded-[24px] bg-[linear-gradient(160deg,#1f2f52,#14213d_60%,#0f182c)] p-6 text-white shadow-[var(--sh-lg)] @min-[640px]:bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_60%,#0b433a)]">
            <div className="text-[14px] font-medium opacity-80">{ready ? longDate(new Date()) : " "}</div>
            <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-.03em]">Willkommen beim {tenant.name.replace(/^Tennis Club /, "TC ")}.</h1>
            <div className="text-[14px] opacity-80">{facts ? `${facts}, ` : ""}{open}–{close} Uhr</div>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link href={`/c/${tenant.slug}/profile`} className={`${btn} btn-pri`}>Mitglied anmelden</Link>
            <Link href={calendarHref} className={btn}>Als Gast buchen</Link>
            <div className="-mt-1 text-center text-[13px] text-ink-3">Ohne Konto.</div>
            <Link href={aboHref} className={btn}>Mitglied werden</Link>
          </div>
          <div>
            <div className="flex items-baseline justify-between pb-2">
              <h2 id="frei" className="text-[17px] font-semibold">Jetzt frei</h2>
              <Link href={calendarHref} className="text-[14px] font-semibold text-brand-deep">Alle Plätze</Link>
            </div>
            {slotCards}
          </div>
        </div>
        <BookingSheet slug={tenant.slug} settings={settings} slot={sheet.slot} onClose={sheet.close} pool={partners} isAnon guestRate={guestRate} needPartner={needPartner} planSports={planSports} wallet={wallet} />
      </>
    );
  }

  // ---- Start (member) ----
  const played = myBookings.filter((b) => new Date(b.endsAt).getTime() <= now).length;
  const total = played + (data?.upcoming.length ?? 0);
  const hasAbo = Boolean(planSports);
  const heatDate = addDays(startOfToday(), heatDay);
  const hours = Array.from({ length: Math.max(0, close - open) }, (_, i) => open + i);
  const cell = "aspect-square rounded-[4px] @min-[640px]:rounded-[6px]";
  const heroCls = "relative flex flex-col gap-3.5 overflow-hidden rounded-[24px] p-5 text-white shadow-[var(--sh-lg)] bg-[linear-gradient(160deg,#1f2f52,#14213d_60%,#0f182c)] @min-[640px]:p-6 @min-[640px]:bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_60%,#0b433a)]";

  return (
    <>
      <div className="flex flex-col gap-3.5 px-5 pb-6 pt-[60px] @min-[640px]:gap-4 @min-[640px]:px-0 @min-[640px]:pt-2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-semibold leading-[1.05] tracking-[-.02em] @min-[640px]:text-[32px]">{greet} {firstName}</h1>
            <div className="mt-1 text-[14px] text-ink-3">{ready ? `${longDate(new Date())}. Plätze offen ${open}–${close} Uhr.` : " "}</div>
          </div>
          <Link href={calendarHref} className="btn btn-pri shrink-0">Reservieren</Link>
        </div>

        <div className="grid gap-3.5 @min-[640px]:grid-cols-2 @min-[640px]:gap-4 @min-[1024px]:grid-cols-[1.15fr_1fr_1fr]">
          {next ? (() => {
            const c = byId.get(next.courtId)!;
            const o = others(next);
            return (
              <div className={`${heroCls} @min-[640px]:col-span-2 @min-[1024px]:col-span-1`}>
                <div aria-hidden className="absolute -right-[60px] -top-[60px] h-[220px] w-[220px] rounded-full bg-white/[.08]" />
                <div className="text-[14px] font-medium opacity-80">Nächstes Spiel</div>
                <div className="text-[54px] font-bold leading-none tracking-[-.04em] @min-[640px]:text-[60px]">
                  {hh(new Date(next.startsAt).getHours())}
                  <small className="ml-2.5 text-[18px] font-medium tracking-normal opacity-85">{relDay(new Date(next.startsAt))}</small>
                </div>
                <div className="text-[15px] font-medium">
                  {courtLabel(c).name}, {SURFACE_LABEL[surfaceKind(c)]}{o.length ? `, mit ${o.map(short).join(", ")}` : ""}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link href={bookingsHref} className="btn flex-1 bg-go text-white shadow-none @min-[640px]:flex-none @min-[640px]:bg-white @min-[640px]:text-brand-dark">Details</Link>
                </div>
              </div>
            );
          })() : (
            <div className={`${heroCls} @min-[640px]:col-span-2 @min-[1024px]:col-span-1`}>
              <div aria-hidden className="absolute -right-[60px] -top-[60px] h-[220px] w-[220px] rounded-full bg-white/[.08]" />
              <div className="text-[14px] font-medium opacity-80">Nächstes Spiel</div>
              <div className="text-[28px] font-bold leading-[1.1] tracking-[-.03em]">{ready ? "Noch kein Spiel geplant." : " "}</div>
              <div className="text-[15px] opacity-85">Tippe unten auf eine freie Zeit oder wähle einen Platz.</div>
              <div className="mt-auto flex gap-2">
                <Link href={calendarHref} className="btn flex-1 bg-go text-white shadow-none @min-[640px]:flex-none @min-[640px]:bg-white @min-[640px]:text-brand-dark">Platz reservieren</Link>
              </div>
            </div>
          )}

          <div className="relative min-h-[200px] overflow-hidden rounded-[24px] bg-[radial-gradient(120%_90%_at_20%_0%,#f08a5f_0%,#d95a2f_45%,#b8441f_100%)] text-white shadow-card @min-[640px]:min-h-[240px]">
            <svg aria-hidden viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
              <g fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="3"><rect x="70" y="30" width="260" height="180" /><line x1="70" y1="52" x2="330" y2="52" /><line x1="70" y1="188" x2="330" y2="188" /><line x1="200" y1="30" x2="200" y2="210" strokeWidth="5" /><rect x="118" y="52" width="164" height="136" /><line x1="118" y1="120" x2="282" y2="120" /></g>
            </svg>
            <span className="absolute left-4 top-4 rounded-full bg-white/[.18] px-3 py-1.5 text-[13px] font-semibold backdrop-blur-md">Jetzt frei, Tipp bucht</span>
            <div className="no-scrollbar absolute inset-x-4 bottom-4 flex flex-nowrap gap-2 overflow-x-auto">
              {data?.quick.map((q) => (
                <button
                  key={q.court.id + q.start.toISOString()}
                  type="button"
                  onClick={() => sheet.open(q)}
                  aria-label={`${relDay(q.start)} ${hh(q.start.getHours())}, ${courtLabel(q.court).name} buchen`}
                  className="chip h-[38px] flex-none bg-white/90 text-[#16201d] shadow-none"
                >
                  {relDay(q.start) !== "Heute" && <span className="text-[#8a9793]">{relDay(q.start)}</span>}
                  <b className="text-[15px]">{hh(q.start.getHours())}</b> {courtLabel(q.court).name}
                </button>
              ))}
              {data && !data.quick.length && <span className="rounded-full bg-white/90 px-3.5 py-2 text-[13.5px] font-semibold text-[#16201d]">Gerade nichts frei.</span>}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3.5 flex items-center justify-between gap-2.5">
              <h2 className="text-[17px] font-semibold">Kommende Buchungen</h2>
              <Link href={bookingsHref} className="text-[14px] font-semibold text-brand-deep">Alle</Link>
            </div>
            <div className="flex flex-col gap-1.5">
              {data?.upcoming.slice(0, 4).map((b) => {
                const c = byId.get(b.courtId)!;
                const o = others(b);
                return (
                  <Link key={b.id} href={bookingsHref} className="flex items-center gap-3 rounded-2xl bg-bg px-3 py-2.5">
                    {o.length ? <Avatar ini={initials(o[0])} className="h-9 w-9 text-[12px]" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card"><Dot color={courtColor(c)} size={12} /></span>}
                    <span className="min-w-0 flex-1">
                      <b className="block text-[14.5px] font-semibold">{dayLabel(new Date(b.startsAt))}, {range(b)}</b>
                      <small className="block truncate text-[12.5px] text-ink-3">{courtLabel(c).name}, {SURFACE_LABEL[surfaceKind(c)]}{o.length ? `, mit ${o.map(short).join(", ")}` : ""}</small>
                    </span>
                  </Link>
                );
              })}
              {data && !data.upcoming.length && <div className="py-2 text-[14px] text-ink-2">Noch nichts geplant.</div>}
            </div>
            {data?.last && (
              <button type="button" disabled={!data.rebook} onClick={() => data.rebook && sheet.open(data.rebook)} className="btn btn-ghost mt-3 h-auto min-h-[42px] w-full whitespace-normal py-2 text-center">
                {data.rebook
                  ? `Nochmal wie letzte Woche: ${WDL[data.rebook.start.getDay()]}, ${hh(data.rebook.start.getHours())}, ${courtLabel(data.rebook.court).name}`
                  : "Nochmal wie letzte Woche: aktuell belegt"}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3.5 @min-[640px]:gap-4 @min-[1024px]:grid-cols-[1.5fr_1fr]">
          <div className="card p-5">
            <div className="mb-3.5 flex items-center justify-between gap-2.5">
              <h2 className="text-[17px] font-semibold">Wann ist {heatDay ? "morgen" : "heute"} frei?</h2>
              <div className="inline-flex gap-1 rounded-full bg-bg p-1">
                {(["Heute", "Morgen"] as const).map((l, i) => (
                  <button key={l} type="button" aria-pressed={heatDay === i} onClick={() => setHeatDay(i as 0 | 1)} className="rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold text-ink-2 aria-pressed:bg-brand-deep aria-pressed:text-white">{l}</button>
                ))}
              </div>
            </div>
            {ready && data && (
              <div className="grid items-center gap-[3px] @min-[640px]:gap-[5px]" style={{ gridTemplateColumns: `52px repeat(${hours.length}, minmax(0, 1fr))` }}>
                <span />
                {hours.map((h, i) => (
                  <span key={h} className={`text-center text-[11px] text-ink-3 ${i % 2 ? "invisible @min-[640px]:visible" : ""}`}>{h}</span>
                ))}
                {data.ordered.map((c) => (
                  <div key={c.id} className="contents">
                    <span className="truncate text-[12.5px] font-semibold text-ink-2">{courtLabel(c).name}</span>
                    {hours.map((h) => {
                      const start = atHour(heatDate, h);
                      const st = slotState(c.id, start, 60, bookings, blocks, userId, now);
                      if (st === "free")
                        return <button key={h} type="button" aria-label={`${courtLabel(c).name}, ${hh(h)} buchen`} onClick={() => sheet.open({ court: c, start })} className={`${cell} bg-[#eef3f1]`} />;
                      return <span key={h} className={`${cell} ${st === "mine" ? "bg-brand-deep" : st === "taken" ? "bg-[#7fc7ae]" : "stripes"}`} />;
                    })}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3.5 text-[12.5px] text-ink-2">
              <span><i className="mr-1.5 inline-block h-3 w-3 rounded-[4px] bg-[#eef3f1] align-[-2px]" />frei, Tipp bucht</span>
              <span><i className="mr-1.5 inline-block h-3 w-3 rounded-[4px] bg-[#7fc7ae] align-[-2px]" />belegt</span>
              <span><i className="mr-1.5 inline-block h-3 w-3 rounded-[4px] bg-brand-deep align-[-2px]" />meine Buchung</span>
              <span><i className="stripes mr-1.5 inline-block h-3 w-3 rounded-[4px] align-[-2px]" />gesperrt oder vorbei</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3.5 flex items-center justify-between gap-2.5">
              <h2 className="text-[17px] font-semibold">Mein Abo</h2>
              {minPlanPrice !== null && aboCta && <Link href={aboHref} className="text-[14px] font-semibold text-brand-deep">{aboCta === "renew" ? "Verlängern" : "Mitglied werden"}</Link>}
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <div className="relative h-[120px] w-[120px] rounded-full" style={{ background: `conic-gradient(var(--brand-deep) ${total ? Math.round((played / total) * 360) : 0}deg, #eef3f1 0)` }}>
                <b className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-card text-[22px] font-bold leading-none tracking-[-.03em]">
                  {played}
                  <small className="mt-0.5 text-[11px] font-medium tracking-normal text-ink-3">gespielt</small>
                </b>
              </div>
              <div className="flex flex-col gap-2 text-[13.5px] [&>div]:flex [&>div]:justify-between [&>div]:gap-2.5 [&_span:last-child]:font-semibold">
                <div><span>Abo</span>{hasAbo ? <span className={`pill ${aboCta === "renew" ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok"}`}>{aboCta === "renew" ? "läuft bald ab" : "aktiv"}</span> : <span>keins</span>}</div>
                <div><span>Guthaben</span><span>CHF {wallet.toFixed(2)}</span></div>
                <div><span>Geplant</span><span>{data?.upcoming.length ?? 0} Spiele</span></div>
              </div>
            </div>
            {!hasAbo && minPlanPrice !== null && (
              <div className="mt-3.5 text-[13.5px] text-ink-2">Mit Abo ohne Platzgebühr, Saison bis 31. März, ab CHF {Number.isInteger(minPlanPrice) ? minPlanPrice : minPlanPrice.toFixed(2)}.</div>
            )}
          </div>
        </div>

        <div className="text-[13px] leading-normal text-ink-3">
          {tenant.name}{tenant.address ? `, ${tenant.address}` : ""}. {facts}. {open}–{close} Uhr.
        </div>
      </div>

      <BookingSheet slug={tenant.slug} settings={settings} slot={sheet.slot} onClose={sheet.close} pool={partners} isAnon={!userId} guestRate={guestRate} needPartner={needPartner} planSports={planSports} wallet={wallet} />
    </>
  );
}
