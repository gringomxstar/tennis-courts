"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookingSheet } from "@/components/app/booking-sheet";
import { BookingDetailSheet } from "@/components/app/booking-detail-sheet";
import { LabeledSwitch } from "@/components/app/switch";
import { Dot } from "@/components/app/avatar";
import { useSheetSlot } from "@/components/app/use-sheet-slot";
import { useNow } from "@/components/app/use-now";
import { addDays, atHour, BOOKING_ROLE_LABEL, bookingAt, bookingColor, courtColor, courtLabel, hhmm, longDate, shortName, slotState, startOfToday, surfaceKind, WD, type SlotState, type SurfaceKind } from "@/lib/courts";
import type { Person } from "@/lib/partners";
import type { BlockReason, Booking, Court, CourtBlock, Tenant, SportType } from "@/types";
import { cn } from "@/lib/utils";

/** Hour chips are 72px + 6px gap; rows open scrolled to this hour. */
const CHIP = 78;
const REASON: Record<BlockReason, string> = {
  RAIN: "Regen", MAINTENANCE: "Wartung", TOURNAMENT: "Turnier", SNOW: "Schnee", TRAINING: "Training",
  EVENT: "Anlass", PRIVATE: "Privat", OTHER: "Gesperrt",
};
const STATE_LABEL: Record<SlotState, string> = { free: "frei", mine: "deine Buchung", taken: "belegt", blocked: "gesperrt", past: "vorbei" };

export function CalendarView({
  tenant,
  courts,
  bookings,
  blocks,
  userId,
  partners,
  wallet,
  windowDays,
  guestRate,
  needPartner = false,
  planSports,
  admin = false,
}: {
  tenant: Tenant;
  courts: Court[];
  bookings: Booking[];
  blocks: CourtBlock[];
  userId?: string;
  partners: Person[];
  wallet: number;
  /** Booking window of the user's plan; the strip never shows more than 7 days. */
  windowDays: number | null;
  guestRate: boolean;
  needPartner?: boolean;
  planSports: SportType[] | null;
  /** Admin calendar: every booking opens its detail sheet and can be cancelled. */
  admin?: boolean;
}) {
  const sheet = useSheetSlot();
  const [detail, setDetail] = useState<Booking | null>(null);
  const nowMs = useNow();
  const ready = nowMs > 0;
  const [picked, setView] = useState<"list" | "grid" | null>(null);
  // remembered per device, read once mounted (ready) so SSR and hydration agree; storage may be blocked
  const view = picked ?? (ready ? storedView() : "list");
  const pickView = (v: "list" | "grid") => {
    setView(v);
    try {
      localStorage.setItem("calendarView", v);
    } catch {}
  };
  const [day, setDay] = useState(0);
  const [filter, setFilter] = useState<"all" | SurfaceKind>("all");
  const open = tenant.settingsJson?.openingHour ?? 7;
  const close = tenant.settingsJson?.closingHour ?? 22;
  const weekHours = Array.from({ length: close - open }, (_, i) => open + i);

  const date = useMemo(() => (ready ? addDays(startOfToday(), day) : null), [ready, day]);
  const days = ready ? Array.from({ length: Math.max(1, Math.min(7, windowDays ?? 7)) }, (_, i) => addDays(startOfToday(), i)) : [];
  // a running slot stays bookable for lateBookingMinutes after its start
  const bookableFrom = nowMs - (tenant.settingsJson?.lateBookingMinutes ?? 15) * 60_000;

  const cell = (court: Court, h: number) => {
    const start = atHour(date!, h);
    return { start, state: slotState(court.id, start, 60, bookings, blocks, userId, bookableFrom) };
  };
  const blockLabel = (court: Court, start: Date) => {
    const b = blocks.find((b) => b.courtId === court.id && new Date(b.startsAt) <= start && new Date(b.endsAt) > start);
    return b ? REASON[b.reason] : "Gesperrt";
  };
  const tap = (court: Court, start: Date, state: SlotState) => {
    if (state === "free") sheet.open({ court, start });
    else if (state === "mine" || (admin && state === "taken")) setDetail(bookingAt(court.id, start, 60, bookings) ?? null);
    else if (state === "blocked") toast(`Platz gesperrt: ${blockLabel(court, start)}`);
  };

  const dayButtons = (compact: boolean) => (
    <div className={cn("flex px-5 @min-[640px]:px-0", compact ? "gap-1.5 pt-2.5" : "gap-2 pt-4")}>
      {days.map((d, i) => {
        const on = i === day;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            onClick={() => setDay(i)}
            className={cn(
              // v3 .days: white cards, the chosen day in ink
              "flex flex-1 flex-col items-center justify-center shadow-card transition-all ease-spring",
              compact ? "h-[54px] rounded-[15px] duration-300" : "h-[66px] gap-0.5 rounded-[18px] duration-[350ms]",
              on ? "bg-ink text-card" : "bg-card text-ink"
            )}
          >
            <span className={cn("font-semibold", on ? "opacity-70" : "text-ink-3", compact ? "text-[12px] leading-[1.1]" : "text-[11.5px]")}>{i === 0 ? "Heute" : WD[d.getDay()]}</span>
            <span className={cn("font-bold", compact ? "text-[17px] leading-[1.15]" : "text-[18px]")}>{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );

  const now = new Date(nowMs);
  // today: start at the current hour; later days: evenings, when most people play
  const startHour = day === 0 ? now.getHours() : 17;
  const shown = courts.filter((c) => filter === "all" || surfaceKind(c) === filter);
  const tint = (color: string, pct: number) => ({ background: `color-mix(in srgb, ${color} ${pct}%, transparent)`, color: `color-mix(in srgb, ${color} 75%, var(--foreground))` });
  const legend = (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 px-5 pt-3 text-[12.5px] text-ink-2 @min-[640px]:px-0">
      {(["MEMBER", "GUEST", "COACH"] as const).map((r) => (
        <span key={r} className="flex items-center gap-1.5">
          <Dot color={bookingColor({ bookingType: r }, tenant.settingsJson)} size={9} />
          {BOOKING_ROLE_LABEL[r]}
        </span>
      ))}
      {userId && (
        <span className="flex items-center gap-1.5">
          <Dot color="var(--me)" size={9} />
          Deine
        </span>
      )}
    </div>
  );

  // desktop (>= 1024, design v3): courts as columns, hours as rows, colored blocks, now-line; the form opens in the right panel
  const HOUR_MS = 3_600_000;
  const nowIdx = day === 0 ? now.getHours() - open : -1;
  const sel = sheet.slot;
  const deskCell = (c: Court, h: number) => {
    const { start, state } = cell(c, h);
    const l = courtLabel(c);
    if (state === "past") return <div key={c.id} className="stripes h-14 rounded-[13px]" />;
    const b = state === "taken" || state === "mine" ? bookingAt(c.id, start, 60, bookings) : undefined;
    const bStart = b ? new Date(b.startsAt).getTime() : 0;
    // a longer booking is drawn once, from the cell it starts in; the cells below stay empty under it
    if (b && bStart < start.getTime() && h > open && cell(c, h - 1).state === state) return <div key={c.id} className="h-14 rounded-[13px] bg-bg" />;
    const rows = b ? Math.max(1, Math.min(close - h, Math.ceil((new Date(b.endsAt).getTime() - start.getTime()) / HOUR_MS))) : 1;
    const picked = state === "free" && sel?.court.id === c.id && sel.start.getTime() === start.getTime();
    const inert = state === "taken" && !admin;
    const ev =
      state === "mine" || state === "taken"
        ? { bg: state === "mine" ? "var(--me)" : bookingColor(b, tenant.settingsJson), fg: "#fff", title: (b && shortName(b)) || (state === "mine" ? "Du" : "Belegt"), sub: state === "mine" ? "Meine Buchung" : b ? BOOKING_ROLE_LABEL[b.bookingType === "GUEST" ? "GUEST" : b.bookingType === "COACH" ? "COACH" : "MEMBER"] : "" }
        : state === "blocked"
          ? { bg: "var(--block)", fg: "var(--ink)", title: blockLabel(c, start), sub: "" }
          : null;
    return (
      <button
        key={c.id}
        type="button"
        disabled={inert}
        onClick={() => tap(c, start, state)}
        aria-label={`${l.name}, ${h}:00, ${STATE_LABEL[state]}${ev?.title && state !== "mine" ? `, ${ev.title}` : ""}`}
        className={cn(
          "relative h-14 rounded-[13px] bg-bg",
          state === "free" && "hover:bg-brand-soft",
          picked && "bg-brand-soft shadow-[inset_0_0_0_2px_var(--brand-deep)]",
          (inert || state === "blocked") && "cursor-default"
        )}
      >
        {picked && <span className="text-[12px] font-semibold text-brand-deep">+ Reservieren</span>}
        {ev && (
          <span
            className="absolute inset-x-0 top-0 z-[1] flex items-center overflow-hidden rounded-[13px] px-[9px] text-left text-[12px] font-semibold leading-[1.2] shadow-[0_8px_18px_-10px_rgba(0,0,0,.35)]"
            style={{ background: ev.bg, color: ev.fg, bottom: `calc(${-(rows - 1) * 100}% - ${(rows - 1) * 5}px)` }}
          >
            <span className="min-w-0">
              <span className="block truncate">{ev.title}</span>
              {ev.sub && <span className="block truncate text-[11px] font-medium opacity-80">{ev.sub}</span>}
            </span>
          </span>
        )}
      </button>
    );
  };
  const deskGrid = ready && date && (
    <div className="hidden flex-col gap-4 @min-[1024px]:flex">
      <div className="flex items-center gap-3 pt-2">
        <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-.02em]">Kalender</h1>
        <div className="flex-1" />
        <button type="button" className="btn w-[42px] px-0" aria-label="Vortag" disabled={day === 0} onClick={() => setDay(day - 1)}>‹</button>
        <span className="btn">{longDate(date)}</span>
        <button type="button" className="btn w-[42px] px-0" aria-label="Folgetag" disabled={day >= days.length - 1} onClick={() => setDay(day + 1)}>›</button>
        <button type="button" className="btn btn-ghost" disabled={day === 0} onClick={() => setDay(0)}>Heute</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {([["all", "Alle Plätze"], ["clay", "Sand"], ["hard", "Allwetter"], ["padel", "Padel"]] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className="chip">
            {id !== "all" && <Dot color={`var(--surface-${id})`} size={9} />}
            {label}
          </button>
        ))}
      </div>
      {/* leave room for the right-hand booking panel (sheet.tsx, >= 1100) */}
      <div className={cn("card px-[22px] py-5", (sel || detail) && "min-[1100px]:mr-[376px]")}>
        <div className="relative grid gap-[5px]" style={{ gridTemplateColumns: `52px repeat(${shown.length}, minmax(0, 1fr))` }}>
          <div />
          {shown.map((c) => {
            const l = courtLabel(c);
            return (
              <div key={c.id} className="flex h-[58px] min-w-0 items-center gap-2 rounded-[14px] bg-bg px-2">
                <span aria-hidden className="h-[9px] w-[9px] flex-none rounded-[3px]" style={{ background: courtColor(c) }} />
                <div className="min-w-0">
                  <b className="block truncate text-[13px] font-semibold">{l.name}</b>
                  <small className="block truncate text-[11px] text-ink-3">{l.sub}</small>
                </div>
              </div>
            );
          })}
          {weekHours.map((h, i) => (
            <Fragment key={h}>
              <div className={cn("flex h-14 items-center justify-center rounded-[12px] text-[12.5px] font-semibold text-ink-2", i === nowIdx && "bg-brand-deep text-white")}>{h}:00</div>
              {shown.map((c) => deskCell(c, h))}
            </Fragment>
          ))}
          {nowIdx >= 0 && nowIdx < weekHours.length && (
            <div aria-hidden className="pointer-events-none absolute left-[57px] right-0 z-[2] border-t-2 border-dashed border-brand-deep" style={{ top: 63 + nowIdx * 61 + (now.getMinutes() / 60) * 56 }}>
              <span className="absolute -left-[52px] -top-2.5 bg-card px-[3px] text-[11px] font-bold text-brand-deep">{hhmm(now)}</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3.5 text-[12.5px] text-ink-2">
          {userId && <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[4px] bg-me" />Meine Buchung</span>}
          {(["MEMBER", "GUEST", "COACH"] as const).map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <i className="inline-block h-3 w-3 rounded-[4px]" style={{ background: bookingColor({ bookingType: r }, tenant.settingsJson) }} />
              {r === "MEMBER" ? "Mitglieder" : r === "COACH" ? "Training" : BOOKING_ROLE_LABEL[r]}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[4px] bg-block" />Gesperrt</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* phone and tablet: the existing Liste/Raster views (owner: keep sideways scroll, slider and grid) */}
      <div className="@min-[1024px]:hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2">
        <h1 className="text-[28px] font-semibold leading-[1.05] tracking-[-.02em]">Kalender</h1>
        <LabeledSwitch left="Liste" right="Raster" label="Rasteransicht" on={view === "grid"} onChange={(g) => pickView(g ? "grid" : "list")} />
      </div>

      {ready && view === "list" && (
        <>
          {dayButtons(false)}
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-1 pt-3.5 @min-[640px]:px-0">
            {([["all", "Alle"], ["clay", "Sand"], ["hard", "Allwetter"], ["padel", "Padel"]] as const).map(([id, label]) => {
              const on = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(id)}
                  className="chip"
                >
                  {id !== "all" && <Dot color={`var(--surface-${id})`} size={9} />}
                  {label}
                </button>
              );
            })}
          </div>
          {legend}
          {/* desktop: courts stacked, all hours in one row that fits the width (no hidden sideways scroll) */}
          <div className="flex flex-col gap-3 px-5 pt-4 @min-[640px]:px-0">
            {shown.map((c) => {
              const l = courtLabel(c);
              return (
                <div key={c.id} className="card p-3.5 sm:p-2.5">
                  <div className="flex items-baseline gap-2 px-1 pb-2">
                    <Dot color={courtColor(c)} size={9} />
                    <div className="text-[15px] font-semibold">{l.name}</div>
                    <div className="text-[12.5px] text-ink-3">{l.sub}</div>
                    <div className="flex-1" />
                    {c.hasLighting && (
                      <svg role="img" aria-label="Flutlicht" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    )}
                  </div>
                  <div ref={(el) => { if (el && el.dataset.day !== String(day)) { el.dataset.day = String(day); el.scrollLeft = Math.max(0, startHour - open) * CHIP; } }} className="no-scrollbar -mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 sm:mx-0 sm:grid sm:auto-cols-fr sm:grid-flow-col sm:gap-1 sm:overflow-visible sm:px-0">
                    {weekHours.map((h) => {
                      const { start, state } = cell(c, h);
                      const inert = (state === "taken" && !admin) || state === "past";
                      const taken = state === "taken" ? tint(bookingColor(bookingAt(c.id, start, 60, bookings), tenant.settingsJson), 16) : undefined;
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={inert}
                          onClick={() => tap(c, start, state)}
                          aria-label={`${l.name}, ${h}:00, ${STATE_LABEL[state]}`}
                          style={taken}
                          className={cn(
                            "flex h-[58px] w-[72px] flex-none items-center justify-center rounded-[14px] text-[17px] font-semibold transition-transform duration-300 ease-spring sm:h-[48px] sm:w-auto sm:min-w-0 sm:rounded-[12px] sm:text-[14px]",
                            state === "free" && "bg-bg text-ink active:scale-[.92]",
                            state === "mine" && "bg-brand-deep text-white active:scale-[.92]",
                            state === "blocked" && "stripes text-ink-3",
                            state === "taken" && "cursor-default",
                            state === "past" && "cursor-default bg-bg text-ink-3 opacity-35",
                            // wider screens hide elapsed hours by time (not state) so all court rows keep the same columns
                            start.getTime() < bookableFrom && "sm:hidden"
                          )}
                        >
                          {state === "blocked" ? "×" : <>{h}<span className="sm:max-2xl:hidden">:00</span></>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {ready && view === "grid" && (
        <>
          {dayButtons(true)}
          {legend}
          <div ref={(el) => { if (el && el.dataset.day !== String(day)) { el.dataset.day = String(day); el.scrollTop = Math.max(0, startHour - open - 1) * 62; } }} className="card mx-5 mt-3 flex h-[650px] overflow-auto @min-[640px]:mx-0">
            <div className="sticky left-0 z-[4] h-max w-[56px] flex-none bg-card">
              <div className="sticky top-0 z-[5] h-[62px] bg-card" />
              {weekHours.map((h) => (
                <div key={h} className={cn("relative box-border", h === open ? "top-1" : "-top-[9px]", "h-[62px] pr-2 text-right text-[13px] font-semibold text-ink-2")}>
                  {h}:00
                </div>
              ))}
            </div>
            {courts.map((c) => {
              const l = courtLabel(c);
              return (
                <div key={c.id} className="h-max w-[calc((min(100vw,640px)-72px)/2)] flex-none border-l border-line">
                  <div className="sticky top-0 z-[3] flex h-[62px] flex-col items-center justify-center gap-0.5 border-b border-line bg-card">
                    <div className="flex items-center gap-1.5 text-[15px] font-semibold">
                      <Dot color={courtColor(c)} size={9} />
                      {l.name}
                    </div>
                    <div className="text-[12px] text-ink-3">{l.sub}</div>
                  </div>
                  {weekHours.map((h) => {
                    const { start, state } = cell(c, h);
                    const isNow = day === 0 && now.getHours() === h;
                    const inert = (state === "taken" && !admin) || state === "past" || state === "blocked";
                    const b = state === "taken" || state === "mine" ? bookingAt(c.id, start, 60, bookings) : undefined;
                    const text =
                      state === "mine" ? (b && shortName(b)) || "Du" : state === "taken" ? (b && shortName(b)) || "Belegt" : state === "blocked" ? blockLabel(c, start) : "";
                    return (
                      <div key={h} className="relative box-border h-[62px] border-t border-line px-1 py-[3px]">
                        <button
                          type="button"
                          disabled={inert}
                          onClick={() => tap(c, start, state)}
                          aria-label={`${l.name}, ${h}:00, ${STATE_LABEL[state]}${text && state === "taken" ? `, ${text}` : ""}`}
                          style={state === "taken" ? { background: bookingColor(b, tenant.settingsJson), color: "#fff" } : undefined}
                          className={cn(
                            "box-border flex h-full w-full items-center rounded-[9px] px-2.5 text-left text-[14px] font-semibold leading-tight transition-transform duration-[250ms] ease-spring",
                            state === "free" && "bg-bg active:scale-[.94]",
                            state === "mine" && "bg-me text-white active:scale-[.94]",
                            state === "blocked" && "stripes cursor-default text-ink-3",
                            state === "taken" && "cursor-default",
                            state === "past" && "cursor-default bg-bg opacity-35"
                          )}
                        >
                          <span className="line-clamp-2">{text}</span>
                        </button>
                        {isNow && (
                          <div aria-hidden className="absolute inset-x-0 z-[2] h-0.5 bg-brand-deep" style={{ top: `${(now.getMinutes() / 60) * 100}%` }}>
                            <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-brand-deep" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}

      </div>

      {deskGrid}

      <BookingSheet slug={tenant.slug} settings={tenant.settingsJson} slot={sheet.slot} onClose={sheet.close} pool={partners} isAnon={!userId} guestRate={guestRate} needPartner={needPartner} planSports={planSports} wallet={wallet} />
      <BookingDetailSheet slug={tenant.slug} settings={tenant.settingsJson} booking={detail} court={courts.find((c) => c.id === detail?.courtId)} userId={userId} admin={admin} onClose={() => setDetail(null)} />
    </>
  );
}

function storedView(): "list" | "grid" {
  try {
    return localStorage.getItem("calendarView") === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}
