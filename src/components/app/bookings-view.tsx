"use client";

import { deadlineText } from "@/lib/booking-rules";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelBookingAction, cancelSeriesAction } from "@/app/actions/booking";
import { Segmented } from "@/components/app/segmented";
import { Dot } from "@/components/app/avatar";
import { useNow } from "@/components/app/use-now";
import { addDays, courtColor, courtLabel, hhmm, startOfToday, WD } from "@/lib/courts";
import type { Booking, Court } from "@/types";

const shortDate = (d: Date) => `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;

const LONG_MONTH = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Group heading: this week, next week, later; past ones by month. */
function groupOf(d: Date, up: boolean) {
  if (!up) return `${LONG_MONTH[d.getMonth()]} ${d.getFullYear()}`;
  const monday = addDays(startOfToday(), -((startOfToday().getDay() + 6) % 7));
  const weeks = Math.floor((d.getTime() - monday.getTime()) / (7 * 86_400_000));
  return weeks <= 0 ? "Diese Woche" : weeks === 1 ? "Nächste Woche" : "Später";
}

export function BookingsView({
  slug,
  userId,
  isCoach = false,
  bookings,
  courts,
  cancelDeadlineMinutes = 24 * 60,
}: {
  slug: string;
  userId?: string;
  isCoach?: boolean;
  bookings: Booking[];
  courts: Court[];
  /** Same rule as cancelDeadlineError in actions/booking.ts — don't offer a button that can only fail. */
  cancelDeadlineMinutes?: number;
}) {
  const router = useRouter();
  const nowMs = useNow();
  const ready = nowMs > 0;
  const [tab, setTab] = useState<"up" | "past">("up");
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const byId = new Map(courts.map((c) => [c.id, c]));
  const now = new Date(nowMs).toISOString();
  const live = bookings.filter((b) => b.status !== "CANCELLED" && byId.has(b.courtId));
  const list =
    tab === "up"
      ? live.filter((b) => b.endsAt > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      : live.filter((b) => b.endsAt <= now).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 20);

  async function act(id: string) {
    if (armed !== id) {
      setArmed(id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    clearTimeout(timer.current);
    setBusy(true);
    const res = await cancelBookingAction(id, slug);
    setBusy(false);
    setArmed(null);
    if (!res.success) return void toast(res.error ?? "Stornieren fehlgeschlagen");
    const refund = "refundAmount" in res ? res.refundAmount : 0;
    toast(refund ? `Storniert · CHF ${refund.toFixed(2)} zurückerstattet` : "Buchung storniert");
    router.refresh();
  }

  async function cancelSeries(id: string) {
    if (!confirm("Alle kommenden Termine dieser Serie stornieren?")) return;
    setBusy(true);
    const res = await cancelSeriesAction(id, slug);
    setBusy(false);
    if (!res.success) return void toast(res.error);
    toast(`${res.cancelled} Termine storniert`);
    router.refresh();
  }

  const up = tab === "up";
  const groups: [string, Booking[]][] = [];
  for (const b of list) {
    const g = groupOf(new Date(b.startsAt), up);
    const last = groups[groups.length - 1];
    if (last?.[0] === g) last[1].push(b);
    else groups.push([g, [b]]);
  }
  const empty = !userId ? (
    <Link href={`/c/${slug}/profile`} className="card block px-5 py-9 text-center">
      <div className="text-[19px] font-bold">Nichts geplant</div>
      <div className="mt-1 text-[15px] text-ink-2">Melde dich an, um zu buchen.</div>
    </Link>
  ) : (
    ready &&
    list.length === 0 && (
      <div className="card px-5 py-9 text-center">
        <div className="text-[19px] font-bold">Nichts geplant</div>
        <div className="mt-1 text-[15px] text-ink-2">Freie Plätze findest du im Kalender.</div>
        <Link href={`/c/${slug}/calendar`} className="btn btn-pri mt-4">Platz reservieren</Link>
      </div>
    )
  );

  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2">
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] font-bold tracking-[-.03em] @min-[640px]:text-[32px]">Buchungen</h1>
        <div className="flex-1" />
        {isCoach && (
          <Link href={`/c/${slug}/trainer`} className="btn btn-ghost">
            Kurs buchen
          </Link>
        )}
        {userId && (
          <Link href={`/c/${slug}/calendar`} className="btn btn-pri">
            Reservieren
          </Link>
        )}
      </div>
      <Segmented
        className="w-full @min-[640px]:max-w-[360px]"
        label="Buchungen filtern"
        options={[["up", "Kommend"], ["past", "Vergangen"]] as const}
        value={tab}
        onChange={setTab}
      />
      {empty}
      {ready && (
        <div className="grid items-start gap-4 @min-[1024px]:grid-cols-2">
          {groups.map(([title, items]) => (
            <div key={title} className="card p-5">
              <h2 className="text-[17px] font-bold tracking-[-.01em]">{title}</h2>
              <ul className="mt-2 divide-y divide-line">
                {items.map((b) => {
                  const c = byId.get(b.courtId)!;
                  const start = new Date(b.startsAt);
                  const players = b.participants
                    .filter((p) => p.userId !== userId && p.role !== "ORGANIZER")
                    .map((p) => (p.user ? `${p.user.firstName} ${p.user.lastName}` : p.guestName))
                    .filter(Boolean)
                    .join(", ");
                  const on = armed === b.id;
                  const open = b.paymentStatus === "UNPAID" && (b.paymentMethod === "ON_SITE" || b.paymentMethod === "INVOICE");
                  const late = start.getTime() - nowMs < cancelDeadlineMinutes * 60_000;
                  const pill =
                    b.status === "PENDING" ? ["Wartet auf Zahlung", "bg-warn-bg text-warn"]
                    : open ? [`CHF ${b.totalCost} ${b.paymentMethod === "ON_SITE" ? "vor Ort" : "Rechnung"}`, "bg-warn-bg text-warn"]
                    : b.paymentStatus === "PAID" && b.totalCost ? [`CHF ${b.totalCost} bezahlt`, "bg-ok-bg text-ok"]
                    : ["inklusive", "bg-ok-bg text-ok"];
                  return (
                    <li key={b.id} className="py-3.5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-[62px] shrink-0">
                          <b className="block text-[22px] font-bold leading-none tracking-[-.03em]">{hhmm(start)}</b>
                          <small className="text-[12.5px] text-ink-3">{shortDate(start)}</small>
                        </div>
                        <div className="min-w-0 flex-1">
                          <b className="flex items-center gap-1.5 text-[16px]"><Dot color={courtColor(c)} />{courtLabel(c).name}</b>
                          <small className="block truncate text-[13.5px] text-ink-2">
                            {b.seriesId ? (b.notes && b.notes !== "Training (Serie)" ? `Kurs ${b.notes}` : "Training, wöchentliche Serie") : players ? `mit ${players}` : "Einzel"}
                          </small>
                        </div>
                        {up && <span className={`pill ${pill[1]}`}>{pill[0]}</span>}
                      </div>
                      {up && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[76px]">
                          {late ? (
                            <small className="text-[13px] text-ink-2">Stornieren nur bis {deadlineText(cancelDeadlineMinutes)} vor Spielbeginn.</small>
                          ) : (
                            <button type="button" disabled={busy && on} onClick={() => act(b.id)} className={`btn h-9 text-[13.5px] ${on ? "bg-bad text-white" : "text-bad"}`}>
                              {on ? "Wirklich stornieren?" : "Stornieren"}
                            </button>
                          )}
                          {b.seriesId && (
                            <button type="button" disabled={busy} onClick={() => cancelSeries(b.id)} className="btn h-9 text-[13.5px] text-bad">
                              {b.notes && b.notes !== "Training (Serie)" ? "Ganzen Kurs stornieren" : "Ganze Serie stornieren"}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
