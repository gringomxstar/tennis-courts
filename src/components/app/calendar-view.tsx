"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookingSheet } from "@/components/app/booking-sheet";
import { Dot } from "@/components/app/avatar";
import { Segmented } from "@/components/app/segmented";
import { useSheetSlot } from "@/components/app/use-sheet-slot";
import { useNow } from "@/components/app/use-now";
import { addDays, atHour, courtColor, courtLabel, slotState, startOfToday, surfaceKind, WD, type SlotState, type SurfaceKind } from "@/lib/courts";
import type { Person } from "@/lib/partners";
import type { BlockReason, Booking, Court, CourtBlock, Tenant } from "@/types";
import { cn } from "@/lib/utils";

const WINS = { morn: [7, 8, 9, 10, 11], day: [12, 13, 14, 15, 16], eve: [17, 18, 19, 20, 21] } as const;
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
}: {
  tenant: Tenant;
  courts: Court[];
  bookings: Booking[];
  blocks: CourtBlock[];
  userId?: string;
  partners: Person[];
}) {
  const router = useRouter();
  const sheet = useSheetSlot();
  const nowMs = useNow();
  const ready = nowMs > 0;
  const [view, setView] = useState<"list" | "week">("list");
  const [day, setDay] = useState(0);
  const [filter, setFilter] = useState<"all" | SurfaceKind>("all");
  const [win, setWin] = useState<keyof typeof WINS>("eve");
  const open = tenant.settingsJson?.openingHour ?? 7;
  const close = tenant.settingsJson?.closingHour ?? 22;
  const weekHours = Array.from({ length: close - open }, (_, i) => open + i);

  const date = useMemo(() => (ready ? addDays(startOfToday(), day) : null), [ready, day]);
  const days = ready ? Array.from({ length: 7 }, (_, i) => addDays(startOfToday(), i)) : [];

  const cell = (court: Court, h: number) => {
    const start = atHour(date!, h);
    return { start, state: slotState(court.id, start, 60, bookings, blocks, userId, nowMs) };
  };
  const tap = (court: Court, start: Date, state: SlotState) => {
    if (state === "free") sheet.open({ court, start });
    else if (state === "mine") router.push(`/c/${tenant.slug}/bookings`);
    else if (state === "blocked") {
      const b = blocks.find((b) => b.courtId === court.id && new Date(b.startsAt) <= start && new Date(b.endsAt) > start);
      toast(`Platz gesperrt: ${b ? REASON[b.reason] : "Gesperrt"}`);
    }
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
              compact ? "h-[46px] rounded-[14px] duration-300" : "h-16 gap-0.5 rounded-[20px] duration-[350ms]",
              on ? "border-clay bg-clay text-white" : "border-border bg-card text-foreground",
              on && !compact && "scale-[1.06]"
            )}
          >
            <span className={cn("font-semibold opacity-90", compact ? "text-[11px] leading-[1.1]" : "text-[12px]")}>{i === 0 ? "Heute" : WD[d.getDay()]}</span>
            <span className={cn("font-bold", compact ? "text-[16px] leading-[1.15]" : "text-[19px] tracking-[-.02em]")}>{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );

  const now = new Date(nowMs);
  const shown = courts.filter((c) => filter === "all" || surfaceKind(c) === filter);

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-[60px] lg:pt-12">
        <h1 className="text-[30px] font-bold tracking-[-.035em]">Kalender</h1>
        <Segmented size="sm" className="w-[180px]" label="Ansicht" value={view} onChange={setView} options={[["list", "Plätze"], ["week", "Woche"]] as const} />
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
                    "flex-none rounded-full border px-4 py-[9px] text-[14px] font-semibold transition-all duration-[250ms]",
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Segmented className="mx-5 mt-3.5 lg:ml-0 lg:w-[340px] lg:flex-none" label="Tageszeit" value={win} onChange={setWin} options={[["morn", "Morgen"], ["day", "Tag"], ["eve", "Abend"]] as const} />
          </div>
          <div className="flex flex-col gap-3 px-5 pt-4 lg:grid lg:grid-cols-2 2xl:grid-cols-3">
            {shown.map((c) => {
              const l = courtLabel(c);
              return (
                <div key={c.id} className="rounded-[24px] border border-border bg-card p-3.5">
                  <div className="flex items-center gap-2 px-1 pb-2.5">
                    <Dot color={courtColor(c)} size={9} />
                    <div className="text-[16px] font-bold tracking-[-.01em]">{l.name}</div>
                    <div className="text-[13px] text-muted-foreground">{l.sub}</div>
                    <div className="flex-1" />
                    {c.hasLighting && (
                      <svg role="img" aria-label="Flutlicht" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {WINS[win].filter((h) => h >= open && h < close).map((h) => {
                      const { start, state } = cell(c, h);
                      const inert = state === "taken" || state === "past";
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={inert}
                          onClick={() => tap(c, start, state)}
                          aria-label={`${l.name}, ${h}:00, ${STATE_LABEL[state]}`}
                          className={cn(
                            "flex h-[46px] flex-1 items-center justify-center rounded-[14px] border text-[15px] font-bold tracking-[-.01em] transition-transform duration-300 ease-spring",
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

      {ready && view === "week" && (
        <>
          {dayButtons(true)}
          <div className="mt-2.5 flex h-[650px] overflow-auto border-t border-border lg:mx-5 lg:h-[calc(100dvh-220px)]">
            <div className="sticky left-0 z-[4] w-[46px] flex-none bg-background">
              <div className="sticky top-0 z-[5] h-[50px] bg-background" />
              {weekHours.map((h) => (
                <div key={h} className="relative -top-[7px] box-border h-[46px] pr-[7px] text-right text-[12px] font-semibold text-muted-foreground">
                  {h}:00
                </div>
              ))}
            </div>
            {courts.map((c) => {
              const l = courtLabel(c);
              return (
                <div key={c.id} className="w-[88px] flex-none border-l border-border lg:w-auto lg:min-w-[88px] lg:flex-1">
                  <div className="sticky top-0 z-[3] flex h-[50px] flex-col items-center justify-center gap-0.5 border-b border-border bg-background">
                    <div className="flex items-center gap-[5px] text-[14px] font-bold">
                      <Dot color={courtColor(c)} size={7} />
                      {l.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{l.sub}</div>
                  </div>
                  {weekHours.map((h) => {
                    const { start, state } = cell(c, h);
                    const isNow = day === 0 && now.getHours() === h;
                    const inert = state === "taken" || state === "past" || state === "blocked";
                    return (
                      <div key={h} className="relative box-border h-[46px] border-t border-border px-[3px] py-0.5">
                        <button
                          type="button"
                          disabled={inert}
                          onClick={() => tap(c, start, state)}
                          aria-label={`${l.name}, ${h}:00, ${STATE_LABEL[state]}`}
                          className={cn(
                            "box-border flex h-full w-full items-center rounded-[10px] px-[9px] text-[13px] font-bold transition-transform duration-[250ms] ease-spring",
                            state === "free" && "bg-free-tint text-clay-text active:scale-[.94]",
                            state === "mine" && "bg-clay text-white active:scale-[.94]",
                            state === "blocked" && "cursor-default bg-acc text-muted-foreground",
                            state === "taken" && "cursor-default bg-acc text-muted-foreground opacity-70",
                            state === "past" && "cursor-default bg-inset opacity-35"
                          )}
                        >
                          {{ free: "Frei", mine: "Du", blocked: "Gesperrt", taken: "Belegt", past: "" }[state]}
                        </button>
                        {isNow && (
                          <div aria-hidden className="absolute inset-x-0 z-[2] h-0.5 bg-[#e25b36]" style={{ top: `${(now.getMinutes() / 60) * 100}%` }}>
                            <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[#e25b36]" />
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

      <BookingSheet slug={tenant.slug} settings={tenant.settingsJson} slot={sheet.slot} onClose={sheet.close} pool={partners} isAnon={!userId} />
    </>
  );
}
