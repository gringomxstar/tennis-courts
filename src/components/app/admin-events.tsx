"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type EventRow = {
  id: string; title: string; startsAt: string; location: string; mailMembers: boolean; cancelled: boolean;
  yes: number; open: number; wait: number; maxSeats: number | null; draft: boolean;
};
export type Opt = { id: string; name: string };

const TZ = "Europe/Zurich";
export const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("de-CH", { timeZone: TZ, ...o });

export const tileOf = (iso: string) => (
  <span className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-brand-tint text-brand-deep">
    <b className="text-[20px] font-bold leading-none tabular-nums">{fmt(iso, { day: "numeric" })}</b>
    <span className="text-[11px] font-bold uppercase">{fmt(iso, { month: "short" }).replace(".", "")}</span>
  </span>
);

function EventListRow({ slug, e }: { slug: string; e: EventRow }) {
  return (
    <Link href={`/c/${slug}/admin/events/${e.id}`} className="flex items-center gap-3 border-t border-line px-1 py-2.5 first:border-t-0">
      {tileOf(e.startsAt)}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{e.title}</span>
          <span className={cn("pill h-5 shrink-0 px-2 text-[11px]", e.cancelled ? "bg-bad-bg text-bad" : "bg-bg text-ink-2")}>{e.cancelled ? "Abgesagt" : e.draft ? "Entwurf" : e.mailMembers ? "Mail" : "nur App"}</span>
        </span>
        <span className="block truncate text-[12.5px] text-ink-3">
          {fmt(e.startsAt, { weekday: "short", hour: "2-digit", minute: "2-digit" })}{e.location ? ` · ${e.location}` : ""}
        </span>
        {!e.draft && <span className="block text-[12.5px] font-semibold">
          {e.yes}{e.maxSeats ? `/${e.maxSeats}` : ""} ja · {e.open} offen{e.wait ? ` · ${e.wait} Warteliste` : ""}
        </span>}
      </span>
    </Link>
  );
}

export function AdminEvents({ slug, upcoming, past }: {
  slug: string; upcoming: EventRow[]; past: EventRow[];
}) {
  const [showPast, setShowPast] = useState(false);
  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 @min-[640px]:gap-4 @min-[640px]:px-0 @min-[640px]:pt-0">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-[28px] font-bold tracking-[-.03em]">Anlässe</h1>
        <Link href={`/c/${slug}/admin/events/neu`} className="btn btn-pri">+ Anlass</Link>
      </div>
      <div className="card p-4 @min-[640px]:p-5">
        {upcoming.length ? upcoming.map((e) => <EventListRow key={e.id} slug={slug} e={e} />) : <div className="py-6 text-center text-[15px] text-ink-2">Keine kommenden Anlässe</div>}
      </div>
      {past.length > 0 && (
        <div className="card p-4 @min-[640px]:p-5">
          <button type="button" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)} className="h-8 text-[15px] font-semibold">
            {showPast ? "▾" : "▸"} Vergangene ({past.length})
          </button>
          {showPast && past.map((e) => <EventListRow key={e.id} slug={slug} e={e} />)}
        </div>
      )}
    </div>
  );
}
