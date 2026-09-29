"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/app/sheet";
import { useNow } from "@/components/app/use-now";
import { Avatar, Dot, Spinner } from "@/components/app/avatar";
import { cancelBookingAction } from "@/app/actions/booking";
import { cancelDeadlineMinutes, deadlineText } from "@/lib/booking-rules";
import { courtColor, courtLabel, hhmm, initials, longDate } from "@/lib/courts";
import type { Booking, Court, TenantSettings } from "@/types";

/** Tap on a booked slot: who plays, and cancel (own booking before the deadline, admins always). */
export function BookingDetailSheet({
  slug,
  settings,
  booking,
  court,
  userId,
  admin = false,
  onClose,
}: {
  slug: string;
  settings: TenantSettings | null | undefined;
  booking: Booking | null;
  court: Court | undefined;
  userId?: string;
  admin?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const now = useNow();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  // keep the last booking so the closing animation still shows its content
  const [shown, setShown] = useState<Booking | null>(booking);
  if (booking && booking !== shown) {
    setShown(booking);
    setArmed(false);
  }
  const b = shown;

  const names = b
    ? [
        b.organizer && `${b.organizer.firstName} ${b.organizer.lastName}`.trim(),
        ...b.participants
          .filter((p) => p.role !== "ORGANIZER")
          .map((p) => (p.user ? `${p.user.firstName} ${p.user.lastName}`.trim() : p.guestName && `${p.guestName} (Gast)`)),
      ].map((n, i) => n || (i === 0 && b.organizerId === userId ? "Du" : "Spieler"))
    : [];
  const start = b ? new Date(b.startsAt) : null;
  const end = b ? new Date(b.endsAt) : null;
  const deadline = cancelDeadlineMinutes(settings);
  const started = start ? start.getTime() <= now : true;
  const tooLate = start ? start.getTime() - now < deadline * 60_000 : true;
  const own = b?.organizerId === userId;
  const canCancel = !started && (admin || (own && !tooLate));

  async function cancel() {
    if (!b) return;
    if (!armed) return setArmed(true);
    setBusy(true);
    const res = await cancelBookingAction(b.id, slug);
    setBusy(false);
    if (!res.success) return void toast(res.error ?? "Stornieren fehlgeschlagen");
    const refund = "refundAmount" in res ? res.refundAmount : 0;
    toast(refund ? `Storniert · CHF ${refund} zurückerstattet` : "Buchung storniert");
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={Boolean(booking)} onOpenChange={(o) => !o && onClose()} title="Buchung">
      {b && start && end && (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[15px] font-semibold text-muted-foreground">{longDate(start)}</div>
              <div className="text-[44px] font-bold leading-none tracking-[-.05em]">
                {hhmm(start)}–{hhmm(end)}
              </div>
            </div>
            {court && (
              <div className="pb-1 text-right">
                <div className="flex items-center justify-end gap-[7px] text-[18px] font-bold">
                  <Dot color={courtColor(court)} size={9} />
                  {courtLabel(court).name}
                </div>
                <div className="text-[14px] text-muted-foreground">{courtLabel(court).sub}</div>
              </div>
            )}
          </div>

          <div className="mt-6 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">
            {b.bookingType === "COACH" ? "Training" : names.length >= 4 ? "Doppel" : "Spieler"}
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {names.map((n, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[16px] bg-inset px-3.5 py-2.5">
                <Avatar ini={initials(n)} />
                <span className="text-[16px] font-semibold">{n}</span>
              </div>
            ))}
          </div>
          {admin && b.paymentStatus && b.totalCost ? (
            <div className="mt-3 text-[14px] text-muted-foreground">
              CHF {b.totalCost} · {b.paymentStatus === "PAID" ? "bezahlt" : b.paymentStatus === "WAIVED" ? "gratis" : "offen"}
            </div>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className={`mt-5 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[18px] text-[17px] font-bold transition-all duration-[250ms] ${armed ? "bg-clay text-white" : "bg-inset text-clay-text"}`}
            >
              {busy && <Spinner />}
              {armed ? "Wirklich stornieren?" : "Stornieren"}
            </button>
          ) : (
            own &&
            !started && (
              <div className="mt-5 text-[14px] text-muted-foreground">
                Stornieren nur bis {deadlineText(deadline)} vor Spielbeginn. Bei Fragen: Club kontaktieren.
              </div>
            )
          )}
        </>
      )}
    </Sheet>
  );
}
