"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelBookingAction } from "@/app/actions/booking";
import { Segmented } from "@/components/app/segmented";
import { Dot } from "@/components/app/avatar";
import { useNow } from "@/components/app/use-now";
import { courtColor, courtLabel, hhmm, longDate, SURFACE_LABEL, surfaceKind, WD } from "@/lib/courts";
import type { Booking, Court } from "@/types";

const MON3 = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const shortDate = (d: Date) => `${WD[d.getDay()]}, ${d.getDate()}. ${MON3[d.getMonth()]}`;

const actCls = "mt-[14px] flex h-[46px] w-full items-center justify-center rounded-[15px] text-[15px] font-bold transition-all duration-[250ms]";
const cardCls = "rounded-[26px] border border-border bg-card";

export function BookingsView({
  slug,
  userId,
  bookings,
  courts,
}: {
  slug: string;
  userId?: string;
  bookings: Booking[];
  courts: Court[];
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
    toast("Buchung storniert");
    router.refresh();
  }

  return (
    <>
      <div className="px-5 pt-[66px] lg:pt-12">
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Buchungen</h1>
      </div>
      <Segmented
        className="mx-5 mt-[14px] lg:max-w-md"
        label="Buchungen filtern"
        options={[["up", "Kommend"], ["past", "Vergangen"]] as const}
        value={tab}
        onChange={setTab}
      />

      {!userId ? (
        <Link href={`/c/${slug}/profile`} className={`${cardCls} mx-5 mt-4 block px-5 py-[34px] text-center`}>
          <div className="text-[19px] font-bold">Nichts geplant</div>
          <div className="mt-1 text-[15px] text-muted-foreground">Melde dich im Profil an, um zu buchen.</div>
        </Link>
      ) : (
        ready &&
        list.length === 0 && (
          <div className={`${cardCls} mx-5 mt-4 px-5 py-[34px] text-center`}>
            <div className="text-[19px] font-bold">Nichts geplant</div>
            <div className="mt-1 text-[15px] text-muted-foreground">Freie Plätze findest du im Kalender.</div>
          </div>
        )
      )}

      <div className="flex flex-col gap-3 px-5 pt-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
        {ready &&
          list.map((b) => {
            const c = byId.get(b.courtId)!;
            const start = new Date(b.startsAt);
            const end = new Date(b.endsAt);
            const players = b.participants
              .filter((p) => p.userId !== userId && p.role !== "ORGANIZER")
              .map((p) => (p.user ? `${p.user.firstName} ${p.user.lastName}` : p.guestName))
              .filter(Boolean)
              .join(", ");
            const up = tab === "up";
            const on = armed === b.id;
            return (
              <div key={b.id} className={`${cardCls} p-[18px]`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[14px] font-semibold text-muted-foreground">{up ? longDate(start) : shortDate(start)}</div>
                    <div className="text-[44px] font-bold leading-[1.05] tracking-[-.045em]">
                      {hhmm(start)}
                      {up && end.getTime() - start.getTime() > 3_600_000 ? `–${hhmm(end)}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5 text-[16px] font-bold">
                      <Dot color={courtColor(c)} />
                      {courtLabel(c).name}
                    </div>
                    <div className="mt-0.5 text-[14px] text-muted-foreground">{SURFACE_LABEL[surfaceKind(c)]}</div>
                  </div>
                </div>
                {up && players && <div className="mt-2 text-[14px] text-muted-foreground">mit {players}</div>}
                {up ? (
                  <button
                    type="button"
                    disabled={busy && on}
                    onClick={() => act(b.id)}
                    className={`${actCls} ${on ? "bg-clay text-white" : "bg-inset text-clay-text"}`}
                  >
                    {on ? "Wirklich stornieren?" : "Stornieren"}
                  </button>
                ) : (
                  <Link href={`/c/${slug}/calendar`} className={`${actCls} bg-inset text-clay-text`}>
                    Nochmal buchen
                  </Link>
                )}
              </div>
            );
          })}
      </div>
    </>
  );
}
