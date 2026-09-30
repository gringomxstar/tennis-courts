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
    toast(refund ? `Storniert · CHF ${refund.toFixed(2)} zurückerstattet` : "Buchung storniert");
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={Boolean(booking)} onOpenChange={(o) => !o && onClose()} title="Buchung">
      {b && start && end && (
        <>
          <div>
            <h2 className="text-[26px] font-bold leading-[1.1] tracking-[-.03em]">
              {longDate(start)}, {hhmm(start)}–{hhmm(end)}
            </h2>
            {court && (
              <div className="mt-1 flex items-center gap-[7px] text-[13.5px] text-ink-2">
                <Dot color={courtColor(court)} size={9} />
                {courtLabel(court).name}, {courtLabel(court).sub}
              </div>
            )}
          </div>

          <div className="mb-1 mt-4 text-[13px] font-semibold text-ink-2">
            {b.bookingType === "COACH" ? "Training" : names.length >= 4 ? "Doppel" : "Spieler"}
          </div>
          <div className="flex flex-col">
            {names.map((n, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-1">
                <Avatar ini={initials(n)} className="h-9 w-9 text-[12px]" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{n}</span>
                {i === 0 && <span className="text-[12.5px] text-ink-3">hat gebucht</span>}
              </div>
            ))}
          </div>
          {admin && b.paymentStatus && b.totalCost ? (
            <div className="sum mt-3">
              <span>Preis</span>
              <b className="font-semibold">
                CHF {b.totalCost} · {b.paymentStatus === "PAID" ? "bezahlt" : b.paymentStatus === "WAIVED" ? "gratis" : "offen"}
              </b>
            </div>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className={`btn mt-4 h-[50px] w-full flex-none text-[15.5px] shadow-none ${armed ? "bg-bad text-white" : "bg-bad-bg text-bad"}`}
            >
              {busy && <Spinner />}
              {armed ? "Wirklich stornieren?" : "Stornieren"}
            </button>
          ) : (
            own &&
            !started && (
              <div className="mt-4 text-center text-[13.5px] text-ink-3">
                Stornieren nur bis {deadlineText(deadline)} vor Spielbeginn. Bei Fragen: Club kontaktieren.
              </div>
            )
          )}
        </>
      )}
    </Sheet>
  );
}
