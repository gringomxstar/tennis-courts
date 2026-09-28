"use client";

import Link from "next/link";
import { Dot } from "@/components/app/avatar";
import { useNow } from "@/components/app/use-now";
import { addDays, atHour, courtColor, courtLabel, hh, relDay, slotState, startOfToday, surfaceKind } from "@/lib/courts";
import type { Booking, Court, CourtBlock } from "@/types";

const SURFACE_ORDER = { clay: 0, hard: 1, padel: 2 } as const;
const MAX = 6;
const card = "flex-none w-[138px] rounded-[24px] border border-border lg:w-auto";

/** The next free hours over three days, one court per hour, computed in the browser's local time. */
export function FreeSlots({
  href,
  courts,
  bookings,
  blocks,
  open,
  close,
}: {
  href: string;
  courts: Court[];
  bookings: Booking[];
  blocks: CourtBlock[];
  open: number;
  close: number;
}) {
  const now = useNow();
  const ordered = [...courts].sort(
    (a, b) => SURFACE_ORDER[surfaceKind(a)] - SURFACE_ORDER[surfaceKind(b)] || a.sortOrder - b.sortOrder
  );
  const slots: { court: Court; start: Date; more: number }[] = [];
  if (now) {
    for (let d = 0; d < 3 && slots.length < MAX; d++) {
      for (let h = open; h < close && slots.length < MAX; h++) {
        const start = atHour(addDays(startOfToday(), d), h);
        const free = ordered.filter((c) => slotState(c.id, start, 60, bookings, blocks, undefined, now) === "free");
        // rotate through the free courts so consecutive hours don't all show the same one
        if (free.length) slots.push({ court: free[slots.length % free.length], start, more: free.length - 1 });
      }
    }
  }

  if (now && !slots.length) {
    return (
      <div className="mx-5 rounded-[22px] bg-inset px-[18px] py-4 text-[15px] text-muted-foreground lg:mx-0">
        In den nächsten drei Tagen ist alles belegt.
      </div>
    );
  }

  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
      {now
        ? slots.map(({ court, start, more }) => {
            const l = courtLabel(court);
            return (
              <Link
                key={court.id + start.toISOString()}
                href={href}
                aria-label={`${relDay(start)} ${hh(start.getHours())}, ${l.name} frei`}
                className={`${card} bg-card p-4 transition-transform duration-[350ms] ease-spring active:scale-[.96]`}
              >
                <div className="text-[13px] font-semibold text-muted-foreground">{relDay(start)}</div>
                <div className="mt-0.5 text-[34px] font-bold leading-[1.1] tracking-[-.04em]">{hh(start.getHours())}</div>
                <div className="mt-2.5 flex items-center gap-1.5 text-[14px] font-semibold">
                  <Dot color={courtColor(court)} />
                  {l.name}
                </div>
                <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{more ? `+${more} weitere frei` : l.sub}</div>
              </Link>
            );
          })
        : Array.from({ length: MAX }, (_, i) => <div key={i} aria-hidden className={`${card} h-[138px] bg-inset`} />)}
    </div>
  );
}
