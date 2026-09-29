"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookingSheet } from "@/components/app/booking-sheet";
import { BookingDetailSheet } from "@/components/app/booking-detail-sheet";
import { LabeledSwitch } from "@/components/app/switch";
import { Dot } from "@/components/app/avatar";
import { useSheetSlot } from "@/components/app/use-sheet-slot";
import { useNow } from "@/components/app/use-now";
import { addDays, atHour, bookingAt, courtColor, courtLabel, shortName, slotState, startOfToday, surfaceKind, WD, type SlotState, type SurfaceKind } from "@/lib/courts";
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
    <div className={cn("flex px-5", compact ? "gap-1.5 pt-2.5" : "gap-2 pt-4")}>
      {days.map((d, i) => {
        const on = i === day;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            onClick={() => setDay(i)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center border transition-all ease-spring",
              compact ? "h-[54px] rounded-[15px] duration-300" : "h-[72px] gap-0.5 rounded-[20px] duration-[350ms]",
              on ? "border-clay bg-clay text-white" : "border-border bg-card text-foreground",
              on && !compact && "scale-[1.06]"
            )}
          >
            <span className={cn("font-semibold opacity-90", compact ? "text-[13px] leading-[1.1]" : "text-[14px]")}>{i === 0 ? "Heute" : WD[d.getDay()]}</span>
            <span className={cn("font-bold", compact ? "text-[19px] leading-[1.15]" : "text-[22px] tracking-[-.02em]")}>{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );

  const now = new Date(nowMs);
  // today: start at the current hour; later days: evenings, when most people play
  const startHour = day === 0 ? now.getHours() : 17;
  const shown = courts.filter((c) => filter === "all" || surfaceKind(c) === filter);

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-[60px] lg:pt-12">
        <h1 className="text-[30px] font-bold tracking-[-.035em]">Kalender</h1>
        <LabeledSwitch left="Liste" right="Raster" label="Rasteransicht" on={view === "grid"} onChange={(g) => pickView(g ? "grid" : "list")} />
      </div>

      {ready && view === "list" && (
        <>
          {dayButtons(false)}
          <div className="lg:flex lg:items-end">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3.5 lg:flex-1">
            {([["all", "Alle"], ["clay", "Sand"], ["hard", "Allwetter"], ["padel", "Padel"]] as const).map(([id, label]) => {
              const on = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "flex-none rounded-full border px-[18px] py-[11px] text-[16px] font-semibold transition-all duration-[250ms]",
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          </div>
          <div className="flex flex-col gap-3 px-5 pt-4 lg:grid lg:grid-cols-2 2xl:grid-cols-3">
            {shown.map((c) => {
              const l = courtLabel(c);
              return (
                <div key={c.id} className="rounded-[24px] border border-border bg-card p-3.5">
                  <div className="flex items-center gap-2 px-1 pb-2.5">
                    <Dot color={courtColor(c)} size={9} />
                    <div className="text-[19px] font-bold tracking-[-.01em]">{l.name}</div>
                    <div className="text-[15px] text-muted-foreground">{l.sub}</div>
                    <div className="flex-1" />
                    {c.hasLighting && (
                      <svg role="img" aria-label="Flutlicht" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    )}
                  </div>
                  <div ref={(el) => { if (el && el.dataset.day !== String(day)) { el.dataset.day = String(day); el.scrollLeft = Math.max(0, startHour - open) * CHIP; } }} className="no-scrollbar -mx-3.5 flex gap-1.5 overflow-x-auto px-3.5">
                    {weekHours.map((h) => {
                      const { start, state } = cell(c, h);
                      const inert = (state === "taken" && !admin) || state === "past";
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={inert}
                          onClick={() => tap(c, start, state)}
                          aria-label={`${l.name}, ${h}:00, ${STATE_LABEL[state]}`}
                          className={cn(
                            "flex h-[58px] w-[72px] flex-none items-center justify-center rounded-[15px] border text-[18px] font-bold tracking-[-.01em] transition-transform duration-300 ease-spring",
                            state === "free" && "border-free-border bg-seg-on text-foreground active:scale-[.92]",
                            state === "mine" && "border-clay bg-clay text-white active:scale-[.92]",
                            state === "blocked" && "border-transparent bg-inset text-muted-foreground opacity-55",
                            state === "taken" && "cursor-default border-transparent bg-inset text-muted-foreground opacity-45",
                            state === "past" && "cursor-default border-transparent bg-inset text-muted-foreground opacity-40"
                          )}
                        >
                          {state === "blocked" ? "×" : `${h}:00`}
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
          <div className="mt-2.5 flex h-[650px] overflow-auto border-t border-border lg:mx-5 lg:h-[calc(100dvh-220px)]">
            <div className="sticky left-0 z-[4] h-max w-[56px] flex-none bg-background">
              <div className="sticky top-0 z-[5] h-[62px] bg-background" />
              {weekHours.map((h) => (
                <div key={h} className={cn("relative box-border", h === open ? "top-1" : "-top-[9px]", "h-[62px] pr-2 text-right text-[15px] font-semibold text-muted-foreground")}>
                  {h}:00
                </div>
              ))}
            </div>
            {courts.map((c) => {
              const l = courtLabel(c);
              return (
                <div key={c.id} className="h-max w-[calc((min(100vw,640px)-56px)/2)] flex-none border-l border-border lg:w-auto lg:min-w-[200px] lg:flex-1">
                  <div className="sticky top-0 z-[3] flex h-[62px] flex-col items-center justify-center gap-0.5 border-b border-border bg-background">
                    <div className="flex items-center gap-1.5 text-[18px] font-bold">
                      <Dot color={courtColor(c)} size={9} />
                      {l.name}
                    </div>
                    <div className="text-[14px] text-muted-foreground">{l.sub}</div>
                  </div>
                  {weekHours.map((h) => {
                    const { start, state } = cell(c, h);
                    const isNow = day === 0 && now.getHours() === h;
                    const inert = (state === "taken" && !admin) || state === "past" || state === "blocked";
                    const b = state === "taken" || state === "mine" ? bookingAt(c.id, start, 60, bookings) : undefined;
                    const text =
                      state === "mine" ? (b && shortName(b)) || "Du" : state === "taken" ? (b && shortName(b)) || "Belegt" : state === "blocked" ? blockLabel(c, start) : "";
                    return (
                      <div key={h} className="relative box-border h-[62px] border-t border-border px-1 py-[3px]">
                        <button
                          type="button"
                          disabled={inert}
                          onClick={() => tap(c, start, state)}
                          aria-label={`${l.name}, ${h}:00, ${STATE_LABEL[state]}${text && state === "taken" ? `, ${text}` : ""}`}
                          className={cn(
                            "box-border flex h-full w-full items-center rounded-[12px] px-2.5 text-left text-[16px] font-bold leading-tight transition-transform duration-[250ms] ease-spring",
                            state === "free" && "bg-free-tint text-clay-text active:scale-[.94]",
                            state === "mine" && "bg-clay text-white active:scale-[.94]",
                            state === "blocked" && "cursor-default bg-acc text-muted-foreground",
                            state === "taken" && "cursor-default bg-acc text-muted-foreground opacity-70",
                            state === "past" && "cursor-default bg-inset opacity-35"
                          )}
                        >
                          <span className="line-clamp-2">{text}</span>
                        </button>
                        {isNow && (
                          <div aria-hidden className="absolute inset-x-0 z-[2] h-0.5 bg-clay" style={{ top: `${(now.getMinutes() / 60) * 100}%` }}>
                            <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-clay" />
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
