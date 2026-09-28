"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelBookingWithTokenAction } from "@/app/actions/booking";
import { Spinner } from "@/components/app/avatar";
import { useNow } from "@/components/app/use-now";
import { hhmm, longDate } from "@/lib/courts";

const STATUS: Record<string, [string, string]> = {
  CONFIRMED: ["Bestätigt", "bg-paid-bg text-paid-fg"],
  PENDING: ["Wartet auf Zahlung", "bg-inset text-muted-foreground"],
  CANCELLED: ["Storniert", "bg-clay text-white"],
  EXPIRED: ["Abgelaufen", "bg-inset text-muted-foreground"],
  COMPLETED: ["Gespielt", "bg-inset text-muted-foreground"],
};
const PAY: Record<string, string> = { ONLINE: "online", ON_SITE: "vor Ort", INVOICE: "auf Rechnung", WALLET: "vom Guthaben" };

export function GuestBookingCard({
  token,
  justPaid,
  booking: b,
  supportEmail,
}: {
  token: string;
  justPaid: boolean;
  booking: {
    id: string;
    court: string;
    clubName: string;
    startsAt: string;
    endsAt: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string | null;
    total: number;
    cancellableUntil: string;
  };
  supportEmail?: string | null;
}) {
  const router = useRouter();
  const now = useNow();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = new Date(b.startsAt);
  const [statusText, statusCls] = STATUS[b.status] ?? [b.status, "bg-inset text-muted-foreground"];
  const canCancel = now > 0 && (b.status === "CONFIRMED" || b.status === "PENDING") && now < Date.parse(b.cancellableUntil);

  async function cancel() {
    if (!armed) return setArmed(true);
    setBusy(true);
    const res = await cancelBookingWithTokenAction(b.id, token).catch(() => null);
    setBusy(false);
    setArmed(false);
    if (!res?.success) return void toast(res?.error ?? "Stornieren fehlgeschlagen");
    const refund = "refundAmount" in res ? res.refundAmount : 0;
    toast(refund ? `Storniert · CHF ${refund} werden zurückerstattet` : "Buchung storniert");
    router.refresh();
  }

  return (
    <div className="px-5 pt-[66px] lg:max-w-[560px] lg:pt-12">
      <h1 className="text-[34px] font-bold tracking-[-.035em]">Meine Buchung</h1>
      <div className="mt-0.5 text-[15px] text-muted-foreground">{b.clubName}</div>

      {justPaid && b.status === "CONFIRMED" && (
        <div role="status" className="mt-4 rounded-[18px] bg-paid-bg px-4 py-3 text-[15px] font-semibold text-paid-fg">
          Zahlung erhalten, deine Buchung ist bestätigt. Die Bestätigung kommt auch per E-Mail.
        </div>
      )}

      <div className="mt-4 rounded-[26px] border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold text-muted-foreground">{now ? longDate(start) : ""}</div>
            <div className="whitespace-nowrap text-[30px] font-bold leading-[1.1] tracking-[-.04em]">
              {now ? `${hhmm(start)} – ${hhmm(new Date(b.endsAt))}` : ""}
            </div>
            <div className="mt-1 text-[17px] font-semibold">{b.court}</div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-bold ${statusCls}`}>{statusText}</span>
        </div>
        {b.total > 0 && (
          <div className="mt-4 flex justify-between rounded-[18px] bg-inset px-4 py-3 text-[16px] font-semibold">
            <span>
              Betrag{b.paymentMethod ? ` · ${PAY[b.paymentMethod] ?? ""}` : ""}
              {b.paymentStatus === "PAID" ? " · bezahlt" : ""}
            </span>
            <span>CHF {b.total.toFixed(2)}</span>
          </div>
        )}
        {canCancel ? (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className={`mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-[16px] text-[16px] font-bold ${armed ? "bg-clay text-white" : "bg-inset text-clay-text"}`}
          >
            {busy && <Spinner />}
            {armed ? "Wirklich stornieren?" : "Buchung stornieren"}
          </button>
        ) : (
          (b.status === "CONFIRMED" || b.status === "PENDING") &&
          now > 0 && (
            <div className="mt-4 text-[14px] text-muted-foreground">
              Die Storno-Frist ist abgelaufen.{supportEmail ? ` Bei Fragen: ${supportEmail}` : ""}
            </div>
          )
        )}
      </div>
    </div>
  );
}
