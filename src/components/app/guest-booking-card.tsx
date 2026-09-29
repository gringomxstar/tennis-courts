"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelBookingWithTokenAction } from "@/app/actions/booking";
import { claimGuestAccountAction, sendGuestAccountLinkAction } from "@/app/actions/auth";
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
  aborted = false,
  booking: b,
  supportEmail,
  slug,
  account,
  minPlanPrice,
}: {
  token: string;
  justPaid: boolean;
  /** Came back from Checkout via "Zurück"; the slot was just released. */
  aborted?: boolean;
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
  slug: string;
  /** Organizer without a password; claimable = this booking created the identity. */
  account: { email: string; claimable: boolean } | null;
  minPlanPrice: number | null;
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

  if (aborted)
    return (
      <div className="px-5 pt-[66px] lg:max-w-[560px] lg:pt-12">
        <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-.035em]">Zahlung abgebrochen</h1>
        <p className="mt-2 text-[17px] text-muted-foreground">Nichts passiert: Es wurde nichts belastet und der Platz ist wieder frei.</p>
        <Link
          href={`/c/${slug}/calendar`}
          className="mt-6 flex h-[54px] w-full items-center justify-center rounded-[17px] bg-clay text-[17px] font-bold text-white active:scale-[.97]"
        >
          Platz neu wählen
        </Link>
      </div>
    );

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
              {b.paymentStatus === "PAID" ? (b.status === "CANCELLED" ? " · zurückerstattet" : " · bezahlt") : ""}
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

      {account &&
        (account.claimable ? (
          <ClaimAccount slug={slug} bookingId={b.id} token={token} email={account.email} />
        ) : (
          <SendAccountLink slug={slug} bookingId={b.id} token={token} email={account.email} />
        ))}

      {minPlanPrice != null && (
        <Link href={`/c/${slug}/abos`} className="mt-4 block text-center text-[15px] font-semibold text-clay-text">
          Öfter hier? Mit Abo ohne Platzgebühr – ab CHF {minPlanPrice} · Saison bis 31. März
        </Link>
      )}
    </div>
  );
}

const Check = () => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-clay">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function ClaimAccount({ slug, bookingId, token, email }: { slug: string; bookingId: string; token: string; email: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // on success the action redirects (signIn); only errors come back
    // no .catch(): it would swallow the signIn redirect and toast a false error (same as demo-switcher)
    const res = await claimGuestAccountAction({ slug, bookingId, token, password });
    setBusy(false);
    if (res?.error) toast(res.error);
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-[26px] border border-border bg-card p-5">
      <h2 className="text-[22px] font-bold leading-[1.15] tracking-[-.03em]">Nächstes Mal ohne Formular.</h2>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Setz ein Passwort – deine E-Mail <span className="font-semibold text-foreground">{email}</span> haben wir schon.
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-[15px] font-semibold">
        {["Buchen mit zwei Taps", "Alle Buchungen an einem Ort", "Direkt in der App stornieren"].map((l) => (
          <li key={l} className="flex items-center gap-2.5">
            <Check />
            {l}
          </li>
        ))}
      </ul>
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <label htmlFor="claim-password" className="sr-only">Passwort</label>
      <input
        id="claim-password"
        type="password"
        autoComplete="new-password"
        minLength={6}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Passwort (mind. 6 Zeichen)"
        className="mt-4 h-[50px] w-full rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay"
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-2.5 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-clay text-[17px] font-bold text-white disabled:opacity-70"
      >
        {busy && <Spinner />}
        Konto erstellen
      </button>
    </form>
  );
}

function SendAccountLink({ slug, bookingId, token, email }: { slug: string; bookingId: string; token: string; email: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");

  async function send() {
    setState("busy");
    const res = await sendGuestAccountLinkAction({ slug, bookingId, token }).catch(() => null);
    if (!res?.ok) {
      setState("idle");
      return void toast(res?.error ?? "Link konnte nicht gesendet werden.");
    }
    setState("sent");
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-[22px] border border-border bg-card px-4 py-3.5">
      <div className="min-w-0 flex-1 text-[15px]">
        <div className="font-bold">Konto erstellen?</div>
        <div className="truncate text-muted-foreground">
          {state === "sent" ? `Link ist unterwegs an ${email}` : `Wir schicken dir einen Link an ${email}`}
        </div>
      </div>
      {state !== "sent" && (
        <button
          type="button"
          onClick={send}
          disabled={state === "busy"}
          className="flex h-[40px] shrink-0 items-center gap-2 rounded-[13px] bg-inset px-4 text-[15px] font-bold text-clay-text disabled:opacity-70"
        >
          {state === "busy" && <Spinner />}
          Link senden
        </button>
      )}
    </div>
  );
}
