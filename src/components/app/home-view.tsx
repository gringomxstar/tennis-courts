"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BookingSheet } from "@/components/app/booking-sheet";
import { Chevron, Dot } from "@/components/app/avatar";
import { useSheetSlot } from "@/components/app/use-sheet-slot";
import { useNow } from "@/components/app/use-now";
import {
  addDays,
  atHour,
  courtColor,
  courtLabel,
  hh,
  longDate,
  relDay,
  slotState,
  startOfToday,
  SURFACE_LABEL,
  surfaceKind,
  WDL,
} from "@/lib/courts";
import type { Person } from "@/lib/partners";
import type { Booking, Court, CourtBlock, Tenant } from "@/types";

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
  minPlanPrice,
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
  minPlanPrice: number | null;
}) {
  const sheet = useSheetSlot();
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
    return { upcoming, quick, last, rebook };
  }, [ready, now, myBookings, courts, bookings, blocks, userId, byId, open, close]);

  const hour = new Date(now).getHours();
  const greet = hour < 11 ? "Guten Morgen," : hour < 18 ? "Guten Tag," : "Guten Abend,";
  const next = data?.upcoming[0];
  const more = data?.upcoming.slice(1, 3) ?? [];
  const counts = courts.reduce(
    (acc, c) => ({ ...acc, [surfaceKind(c)]: (acc[surfaceKind(c)] ?? 0) + 1 }),
    {} as Record<string, number>
  );
  const bookingsHref = `/c/${tenant.slug}/bookings`;

  const range = (b: Booking) => {
    const s = new Date(b.startsAt), e = new Date(b.endsAt);
    const mins = (e.getTime() - s.getTime()) / 60_000;
    return hh(s.getHours()) + (mins > 60 ? "–" + hh(e.getHours()) : "");
  };

  return (
    <>
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
      <div>
      <div className="px-5 pt-[66px] lg:pt-12">
        <div className="text-[15px] font-medium text-muted-foreground">{ready ? longDate(new Date()) : " "}</div>
        <h1 className="mt-1.5 text-[42px] font-bold leading-[1.02] tracking-[-.035em]">
          {userId ? greet : "Willkommen"}
          <br />
          {userId ? `${firstName}.` : `beim ${tenant.name.replace(/^Tennis Club /, "TC ")}.`}
        </h1>
      </div>

      {next && (() => {
        const c = byId.get(next.courtId)!;
        const color = courtColor(c);
        const others = next.participants
          .filter((p) => p.userId !== userId && p.role !== "ORGANIZER")
          .map((p) => (p.user ? `${p.user.firstName} ${p.user.lastName[0] ?? ""}.` : p.guestName))
          .filter(Boolean);
        return (
          <Link
            href={bookingsHref}
            className="relative mx-5 mt-[22px] block overflow-hidden rounded-[30px] p-[22px] text-white transition-[background] duration-[400ms]"
            style={{ background: color, boxShadow: `0 18px 40px -14px ${color}` }}
          >
            <div aria-hidden className="absolute -right-[50px] -top-[50px] h-[190px] w-[190px] rounded-full bg-white/[.14]" />
            <div aria-hidden className="absolute right-5 top-5 h-[86px] w-[86px] rounded-full border-2 border-white/35" />
            <div className="text-[13px] font-bold uppercase tracking-[.08em]">Dein nächstes Spiel</div>
            <div className="mt-2.5 text-[72px] font-bold leading-none tracking-[-.05em]">{hh(new Date(next.startsAt).getHours())}</div>
            <div className="mt-1.5 text-[17px] font-semibold">
              {relDay(new Date(next.startsAt))} · {courtLabel(c).name}
            </div>
            <div className="mt-0.5 text-[15px]">
              {SURFACE_LABEL[surfaceKind(c)]}
              {others.length ? ` · mit ${others.join(", ")}` : ""}
            </div>
          </Link>
        );
      })()}

      {more.length > 0 && (
        <div className="mx-5 mt-2.5 flex flex-col gap-2">
          {more.map((b) => {
            const c = byId.get(b.courtId)!;
            return (
              <Link key={b.id} href={bookingsHref} className="flex items-center gap-3.5 rounded-[22px] border border-border bg-card px-[18px] py-3.5">
                <div className="min-w-[78px]">
                  <div className="text-[13px] font-semibold text-muted-foreground">{relDay(new Date(b.startsAt))}</div>
                  <div className="text-[22px] font-bold leading-[1.15] tracking-[-.03em]">{range(b)}</div>
                </div>
                <div className="flex flex-1 items-center gap-[7px] text-[15px] font-semibold">
                  <Dot color={courtColor(c)} />
                  {courtLabel(c).name} · {SURFACE_LABEL[surfaceKind(c)]}
                </div>
                <Chevron />
              </Link>
            );
          })}
        </div>
      )}

      {!userId && (
        <div className="mx-5 mt-[22px] rounded-[30px] border border-border bg-card p-[22px]">
          <a
            href="#frei"
            onClick={(e) => {
              e.preventDefault();
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              document.getElementById("frei")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
            }}
            className="flex h-[54px] w-full items-center justify-center rounded-[17px] bg-clay text-[17px] font-bold text-white active:scale-[.97]"
          >
            Als Gast buchen
          </a>
          <div className="mt-2 text-center text-[14px] text-muted-foreground">Ohne Konto. Bezahlen mit Twint oder Karte.</div>
          <Link
            href={`/c/${tenant.slug}/profile`}
            className="mt-[14px] flex h-[54px] w-full items-center justify-center rounded-[17px] bg-inset text-[17px] font-bold active:scale-[.97]"
          >
            Mitglied? Anmelden
          </Link>
          {minPlanPrice !== null && (
            <Link href={`/c/${tenant.slug}/abos`} className="mt-3 block text-center text-[15px] font-semibold text-clay-text">
              Abos ab CHF {Number.isInteger(minPlanPrice) ? minPlanPrice : minPlanPrice.toFixed(2)}/Jahr
            </Link>
          )}
        </div>
      )}

      {userId && ready && !next && (
        <div className="mx-5 mt-[22px] rounded-[30px] border border-border bg-card p-[22px]">
          <div className="text-[22px] font-bold tracking-[-.02em]">Noch kein Spiel geplant.</div>
          <div className="mt-1 text-[15px] text-muted-foreground">Wähle unten einen freien Platz. Ein Tap genügt.</div>
        </div>
      )}

      </div>

      <div>
      <div className="flex items-baseline justify-between px-5 pb-3 pt-[30px] lg:pt-12">
        <h2 id="frei" className="scroll-mt-[76px] text-[22px] font-bold tracking-[-.02em]">Jetzt frei</h2>
        <Link href={`/c/${tenant.slug}/calendar`} className="text-[15px] font-semibold text-clay-text">
          Alle Plätze
        </Link>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
        {data?.quick.map((q) => {
          const l = courtLabel(q.court);
          return (
            <button
              key={q.court.id + q.start.toISOString()}
              type="button"
              onClick={() => sheet.open(q)}
              aria-label={`${relDay(q.start)} ${hh(q.start.getHours())}, ${l.name} buchen`}
              className="w-[138px] flex-none lg:w-auto rounded-[24px] border border-border bg-card p-4 text-left transition-transform duration-[350ms] ease-spring hover:-translate-y-1 hover:scale-[1.02] active:scale-[.96]"
            >
              <div className="text-[13px] font-semibold text-muted-foreground">{relDay(q.start)}</div>
              <div className="mt-0.5 text-[34px] font-bold leading-[1.1] tracking-[-.04em]">{hh(q.start.getHours())}</div>
              <div className="mt-2.5 flex items-center gap-1.5 text-[14px] font-semibold">
                <Dot color={courtColor(q.court)} />
                {l.name}
              </div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{l.sub}</div>
            </button>
          );
        })}
      </div>

      {data?.last && (
        <button
          type="button"
          disabled={!data.rebook}
          onClick={() => data.rebook && sheet.open(data.rebook)}
          className="mx-5 mt-[22px] flex w-[calc(100%-40px)] items-center gap-3.5 rounded-[22px] bg-inset px-[18px] py-4 text-left"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-card text-clay-text">
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
          </span>
          <span className="flex-1">
            <span className="block text-[16px] font-bold">Nochmal wie letzte Woche</span>
            <span className="mt-px block text-[14px] text-muted-foreground">
              {data.rebook
                ? `${WDL[data.rebook.start.getDay()]}, ${hh(data.rebook.start.getHours())} · ${courtLabel(data.rebook.court).name} · ${SURFACE_LABEL[surfaceKind(data.rebook.court)]}`
                : "Aktuell belegt"}
            </span>
          </span>
          <Chevron />
        </button>
      )}
      </div>
      </div>

      <div className="px-5 pt-[26px] text-[13px] leading-normal text-muted-foreground">
        {tenant.name}
        {tenant.address ? ` · ${tenant.address}` : ""}
        <br />
        {[counts.clay && `${counts.clay} Sand`, counts.hard && `${counts.hard} Allwetter`, counts.padel && `${counts.padel} Padel`]
          .filter(Boolean)
          .join(" · ")}{" "}
        · {open}–{close} Uhr
      </div>

      <BookingSheet slug={tenant.slug} settings={settings} slot={sheet.slot} onClose={sheet.close} pool={partners} isAnon={!userId} guestRate={guestRate} wallet={wallet} />
    </>
  );
}
