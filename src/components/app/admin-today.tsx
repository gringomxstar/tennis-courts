"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, Dot } from "@/components/app/avatar";
import { SwitchKnob } from "@/components/app/switch";
import { ConfirmButton } from "@/components/app/confirm-button";
import { cn } from "@/lib/utils";
import { useNow } from "@/components/app/use-now";
import { cancelBookingAction, createCourtBlockAction, deleteCourtBlockAction, markBookingPaidOfflineAction } from "@/app/actions/booking";
import { addDays, atHour, courtColor, courtLabel, hhmm, initials, longDate, slotState } from "@/lib/courts";
import type { Booking, Court, CourtBlock, TenantSettings } from "@/types";

/** Local midnight (ms) on the client, null during SSR so server/client never disagree about "now". */
export function useToday() {
  const now = useNow();
  return { now, today: now > 0 ? new Date(now).setHours(0, 0, 0, 0) : null };
}

export const overlapsDay = (b: { startsAt: string; endsAt: string }, day: number) =>
  new Date(b.startsAt).getTime() < addDays(new Date(day), 1).getTime() && new Date(b.endsAt).getTime() > day;

const BAR = { blocked: "stripes", busy: "bg-brand-deep", free: "bg-brand-soft" } as const;

export function AdminToday({
  slug,
  settings,
  courts,
  bookings,
  blocks,
  openPayments,
}: {
  slug: string;
  settings: TenantSettings | null | undefined;
  courts: Court[];
  bookings: Booking[];
  blocks: CourtBlock[];
  openPayments: { id: string; name: string; court: string; startsAt: string; amount: number; method: string }[];
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

  /** "Max Muster + Anna B. + Peter (Gast)" — Buchender zuerst, dann alle Mitspieler. */
  const playersOf = (b: Booking) =>
    [
      nameOf(b),
      ...b.participants
        .filter((p) => p.role !== "ORGANIZER" && p.role !== "COACH")
        .map((p) => (p.user ? `${p.user.firstName} ${p.user.lastName}`.trim() : p.guestName ? `${p.guestName} (Gast)` : "")),
    ]
      .filter(Boolean)
      .join(" + ");

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

  // Regen: every sand court blocked all day today, reason RAIN
  const sand = courts.filter((c) => c.surface === "CLAY" && c.sportType !== "PADEL");
  const rainBlocks = today === null ? [] : blocks.filter((b) => b.reason === "RAIN" && sand.some((c) => c.id === b.courtId) && overlapsDay(b, today));
  const [rain, setRain] = useOptimistic(sand.length > 0 && sand.every((c) => rainBlocks.some((b) => b.courtId === c.id)));
  function toggleRain() {
    if (today === null || !sand.length) return;
    const on = rain;
    startTransition(async () => {
      setRain(!on);
      const results = on
        ? await Promise.all(rainBlocks.map((b) => deleteCourtBlockAction({ clubSlug: slug, blockId: b.id })))
        : [
            await createCourtBlockAction({
              clubSlug: slug,
              items: sand
                .filter((c) => !rainBlocks.some((b) => b.courtId === c.id))
                .map((c) => ({ courtId: c.id, startsAt: atHour(new Date(today), open).toISOString(), endsAt: atHour(new Date(today), close).toISOString() })),
              reason: "RAIN",
            }),
          ];
      const failed = results.find((r) => !r.success);
      if (failed) toast(failed.error ?? "Sperre fehlgeschlagen");
      router.refresh();
    });
  }

  const todays = today === null ? [] : bookings.filter((b) => b.status !== "CANCELLED" && overlapsDay(b, today));
  const guests = todays.filter((b) => b.participants.some((p) => p.guestName)).length;

  function markPaid(id: string, waive = false) {
    startTransition(async () => {
      hide(id);
      const res = await markBookingPaidOfflineAction(slug, id, waive);
      toast(res.success ? (waive ? "Nicht verrechnet (im Verlauf des Mitglieds vermerkt)" : "Als bezahlt markiert") : (res.error ?? "Fehlgeschlagen"));
      router.refresh();
    });
  }

  const kpi = (label: string, value: string | number, sub: string, hero = false) => (
    <div className={cn("card flex flex-col gap-2.5 p-4 @min-[640px]:px-[22px] @min-[640px]:py-5", hero && "bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_70%)] text-white")}>
      <span className="text-[14px] font-medium opacity-85">{label}</span>
      <b className="text-[28px] font-bold leading-none tracking-[-.04em] tabular-nums @min-[640px]:text-[36px]">{value}</b>
      <span className="text-[13px] font-semibold opacity-85">{sub}</span>
    </div>
  );

  return (
    <>
      <div className="flex items-end justify-between gap-3 px-5 pt-[66px] @min-[640px]:px-0 @min-[640px]:pt-0">
        <div>
          <Link href={`/c/${slug}/admin`} className="@min-[640px]:hidden inline-flex items-center gap-1 text-[15px] font-semibold text-clay-text"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Verwaltung</Link>
          <h1 className="text-[28px] font-bold tracking-[-.03em]">Heute</h1>
          <div className="mt-0.5 text-[15px] text-muted-foreground">{day ? longDate(day) : " "}</div>
        </div>
        <Link href={`/c/${slug}/admin/blocks`} className="btn">Sperre planen</Link>
      </div>

      <div className="flex flex-col gap-3.5 px-5 pt-4 pb-6 @min-[640px]:gap-4 @min-[640px]:px-0">
        {sand.length > 0 && (
          <button
            type="button"
            aria-pressed={rain}
            onClick={toggleRain}
            className="card flex items-center gap-3 p-4 text-left @min-[640px]:px-5"
          >
            <span className="min-w-0 flex-1">
              <b className="block text-[16px]">Regen: alle Sandplätze sperren</b>
              <small className="block text-[13px] text-ink-3">{rain ? "Gesperrt bis Tagesende. Zum Aufheben antippen." : `${sand.length} Plätze, heute ganztägig`}</small>
            </span>
            <SwitchKnob on={rain} />
          </button>
        )}

        <div className="grid grid-cols-2 gap-2.5 @min-[640px]:gap-4 @min-[1024px]:grid-cols-4">
          {kpi("Auslastung", `${util}%`, "belegte Platzstunden", true)}
          {kpi("Buchungen", todays.length, guests ? `davon ${guests} Gäste` : "heute")}
          {kpi("Gesperrt", blockedCount, blockedCount === 1 ? "Platz heute" : "Plätze heute")}
          {kpi("Offen", openPayments.filter((p) => !gone.includes(p.id)).length, "Zahlungen vor Ort / Rechnung")}
        </div>

        <div className="grid items-start gap-3.5 @min-[640px]:gap-4 @min-[1024px]:grid-cols-2">
          <div className="card flex flex-col gap-[9px] p-4 @min-[640px]:p-5">
            <h2 className="mb-1 text-[18px] font-bold tracking-[-.02em]">Belegung</h2>
            {rows.map((r) => (
              <div key={r.court.id} className="flex items-center gap-2.5">
                <div className="w-14 shrink-0 truncate text-[13px] font-semibold">{courtLabel(r.court).name}</div>
                <div className="flex flex-1 gap-[2px]">
                  {r.bars.map((k, i) => (
                    <div key={i} className={cn("h-5 flex-1 rounded-[4px]", BAR[k])} />
                  ))}
                </div>
              </div>
            ))}
            <div aria-hidden className="flex justify-between pl-[66px] text-[12px] text-ink-3">
              {labels.map((h, i) => (
                <span key={i}>{h}</span>
              ))}
            </div>
          </div>

          <div className="card p-4 @min-[640px]:p-5">
            <h2 className="mb-1 text-[18px] font-bold tracking-[-.02em]">Nächste Buchungen</h2>
            {!upcoming.length && <div className="py-3 text-[15px] text-ink-3">Heute keine weiteren Buchungen.</div>}
            {upcoming.map((b) => {
              const name = nameOf(b);
              const court = byId.get(b.courtId) ?? b.court;
              return (
                <div key={b.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                  <b className="w-12 shrink-0 text-[15px] tabular-nums">{hhmm(new Date(b.startsAt))}</b>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate text-[15px] font-bold">
                      {court && <Dot color={courtColor(court)} size={9} />}
                      {court ? courtLabel(court).name : ""}
                    </div>
                    <div className="truncate text-[13px] text-ink-3">{b.bookingType === "COACH" ? `Training · ${b.notes && !b.notes.startsWith("Training") ? b.notes : playersOf(b)}` : playersOf(b)}</div>
                  </div>
                  <ConfirmButton onConfirm={() => cancel(b)} confirm="Wirklich?" aria-label={`Buchung von ${name} stornieren`} className="btn btn-ghost text-bad">
                    Stornieren
                  </ConfirmButton>
                </div>
              );
            })}
          </div>
        </div>

        {openPayments.some((p) => !gone.includes(p.id)) && (
          <div className="card p-4 @min-[640px]:p-5">
            <h2 className="mb-1 text-[18px] font-bold tracking-[-.02em]">Offene Zahlungen</h2>
            {openPayments
              .filter((p) => !gone.includes(p.id))
              .map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
                  <Avatar ini={initials(p.name)} />
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="truncate text-[15px] font-bold">{p.name}</div>
                    <div className="text-[13px] text-ink-3">
                      {now ? `${longDate(new Date(p.startsAt))}, ${hhmm(new Date(p.startsAt))}` : ""} · CHF {Number(p.amount).toFixed(2)} · {p.method}
                    </div>
                  </div>
                  <ConfirmButton onConfirm={() => markPaid(p.id, true)} confirm="Gratis lassen?" aria-label={`Zahlung von ${p.name} nicht verrechnen`} className="h-[42px] rounded-full px-3 text-[14px] font-semibold text-ink-3 underline underline-offset-2">
                    Nicht verrechnen
                  </ConfirmButton>
                  <button type="button" onClick={() => markPaid(p.id)} aria-label={`Zahlung von ${p.name} als bezahlt markieren`} className="btn btn-pri">
                    Bezahlt
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
