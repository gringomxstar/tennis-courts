"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, Chevron } from "@/components/app/avatar";
import { useNow } from "@/components/app/use-now";
import { cancelBookingAction } from "@/app/actions/booking";
import { addDays, atHour, courtLabel, hhmm, initials, longDate, slotState } from "@/lib/courts";
import type { Booking, Court, CourtBlock, TenantSettings } from "@/types";

/** Local midnight (ms) on the client, null during SSR so server/client never disagree about "now". */
export function useToday() {
  const now = useNow();
  return { now, today: now > 0 ? new Date(now).setHours(0, 0, 0, 0) : null };
}

export const overlapsDay = (b: { startsAt: string; endsAt: string }, day: number) =>
  new Date(b.startsAt).getTime() < addDays(new Date(day), 1).getTime() && new Date(b.endsAt).getTime() > day;

const BAR = { blocked: "bg-bar-blocked", busy: "bg-clay", free: "bg-inset" } as const;

export function AdminToday({
  slug,
  settings,
  courts,
  bookings,
  blocks,
}: {
  slug: string;
  settings: TenantSettings | null | undefined;
  courts: Court[];
  bookings: Booking[];
  blocks: CourtBlock[];
}) {
  const router = useRouter();
  const { now, today } = useToday();
  const [, startTransition] = useTransition();
  const [gone, hide] = useOptimistic<string[], string>([], (s, id) => [...s, id]);

  const open = settings?.openingHour ?? 7;
  const close = settings?.closingHour ?? 22;
  const hours = Array.from({ length: Math.max(0, close - open) }, (_, i) => open + i);
  const labels = hours.length ? [hours[0], hours[0] + 5, hours[0] + 10, hours[hours.length - 1]] : [];

  const day = today === null ? null : new Date(today);
  let busyN = 0;
  const rows = day
    ? courts.map((c) => ({
        court: c,
        bars: hours.map((h) => {
          const s = slotState(c.id, atHour(day, h), 60, bookings, blocks, undefined, now);
          const kind = s === "blocked" ? "blocked" : s === "taken" || s === "mine" ? "busy" : "free";
          if (kind !== "free") busyN++;
          return kind;
        }),
      }))
    : [];
  const util = rows.length && hours.length ? Math.round((busyN / (rows.length * hours.length)) * 100) : 0;
  const blockedCount = today === null ? 0 : courts.filter((c) => blocks.some((b) => b.courtId === c.id && overlapsDay(b, today))).length;

  const byId = new Map(courts.map((c) => [c.id, c]));
  const upcoming =
    today === null
      ? []
      : bookings
          .filter((b) => b.status !== "CANCELLED" && !gone.includes(b.id) && new Date(b.endsAt).getTime() > now && overlapsDay(b, today))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const nameOf = (b: Booking) =>
    b.organizer ? `${b.organizer.firstName} ${b.organizer.lastName}`.trim() : b.participants.find((p) => p.guestName)?.guestName ?? "Gast";

  function cancel(b: Booking) {
    const name = nameOf(b);
    startTransition(async () => {
      hide(b.id);
      const res = await cancelBookingAction(b.id, slug);
      if (!res.success) {
        toast(res.error ?? "Stornierung fehlgeschlagen");
        return;
      }
      toast(`Storniert · ${name} informiert`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="px-5 pt-[66px] lg:pt-12">
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Heute</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">Belegung · {day ? longDate(day) : " "}</div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-3 lg:px-5 lg:pt-4">
      <div className="flex gap-3 px-5 pt-4 lg:flex-col lg:px-0 lg:pt-0">
        <div className="flex-1 rounded-[24px] bg-clay p-[18px] text-white">
          <div className="text-[13px] font-bold">Auslastung</div>
          <div className="text-[44px] font-bold leading-[1.1] tracking-[-.04em]">{util}%</div>
        </div>
        <div className="flex-1 rounded-[24px] border border-border bg-card p-[18px]">
          <div className="text-[13px] font-bold text-muted-foreground">Gesperrt</div>
          <div className="text-[44px] font-bold leading-[1.1] tracking-[-.04em]">{blockedCount}</div>
        </div>
      </div>

      <div className="mx-5 mt-3 flex flex-col gap-[9px] rounded-[24px] border border-border bg-card p-4 lg:m-0 lg:justify-center">
        {rows.map((r) => (
          <div key={r.court.id} className="flex items-center gap-2.5">
            <div className="w-14 text-[13px] font-semibold">{courtLabel(r.court).name}</div>
            <div className="flex flex-1 gap-[2px]">
              {r.bars.map((k, i) => (
                <div key={i} className={`h-5 flex-1 rounded-[4px] ${BAR[k]}`} />
              ))}
            </div>
          </div>
        ))}
        <div aria-hidden className="flex justify-between pl-[66px] text-[12px] text-muted-foreground">
          {labels.map((h, i) => (
            <span key={i}>{h}</span>
          ))}
        </div>
      </div>
      </div>

      <h2 className="px-5 pb-2.5 pt-6 text-[20px] font-bold tracking-[-.02em]">Nächste Buchungen</h2>
      <div className="flex flex-col gap-2.5 px-5 lg:grid lg:grid-cols-2">
        {upcoming.map((b) => {
          const name = nameOf(b);
          const court = byId.get(b.courtId) ?? b.court;
          return (
            <div key={b.id} className="flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5">
              <Avatar ini={initials(name)} />
              <div className="flex-1">
                <div className="text-[16px] font-bold">{name}</div>
                <div className="text-[14px] text-muted-foreground">
                  {hhmm(new Date(b.startsAt))} · {court ? courtLabel(court).name : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => cancel(b)}
                aria-label={`Buchung von ${name} stornieren`}
                className="rounded-[12px] bg-inset px-3.5 py-[9px] text-[14px] font-bold text-clay-text"
              >
                Stornieren
              </button>
            </div>
          );
        })}
        <Link
          href={`/c/${slug}/admin/settings`}
          className="flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5"
        >
          <div className="flex-1 text-[16px] font-bold">Club-Einstellungen</div>
          <Chevron />
        </Link>
      </div>
    </>
  );
}
