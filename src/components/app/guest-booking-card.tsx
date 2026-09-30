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
  CONFIRMED: ["Bestätigt", "bg-ok-bg text-ok"],
  PENDING: ["Wartet auf Zahlung", "bg-warn-bg text-warn"],
  CANCELLED: ["Storniert", "bg-bad-bg text-bad"],
  EXPIRED: ["Abgelaufen", "bg-bad-bg text-bad"],
  COMPLETED: ["Gespielt", "bg-bg text-ink-2"],
};
const PAY: Record<string, string> = { ONLINE: "online", ON_SITE: "vor Ort", INVOICE: "auf Rechnung", WALLET: "vom Guthaben" };
const shell = "mx-auto flex w-full max-w-[460px] flex-col gap-4 px-5 pb-8 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2";
const input = "h-12 w-full rounded-[14px] bg-bg px-4 text-[15px] text-ink outline-none focus:shadow-[inset_0_0_0_2px_var(--brand-deep)]";

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
  const [statusText, statusCls] = STATUS[b.status] ?? [b.status, "bg-bg text-ink-2"];
  const canCancel = now > 0 && (b.status === "CONFIRMED" || b.status === "PENDING") && now < Date.parse(b.cancellableUntil);

  async function cancel() {
    if (!armed) return setArmed(true);
    setBusy(true);
    const res = await cancelBookingWithTokenAction(b.id, token).catch(() => null);
    setBusy(false);
    setArmed(false);
    if (!res?.success) return void toast(res?.error ?? "Stornieren fehlgeschlagen");
    const refund = "refundAmount" in res ? res.refundAmount : 0;
    toast(refund ? `Storniert · CHF ${refund.toFixed(2)} werden zurückerstattet` : "Buchung storniert");
    router.refresh();
  }

  if (aborted)
    return (
      <div className={shell}>
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-.03em]">Zahlung abgebrochen</h1>
        <p className="text-[16px] text-ink-2">Nichts passiert: Es wurde nichts belastet und der Platz ist wieder frei.</p>
        <Link href={`/c/${slug}/calendar`} className="btn btn-pri h-[54px] w-full text-[16px]">
          Platz neu wählen
        </Link>
      </div>
    );

  return (
    <div className={shell}>
      <div>
        <h1 className="text-[28px] font-bold tracking-[-.03em]">Meine Buchung</h1>
        <div className="text-[14px] text-ink-2">{b.clubName}</div>
      </div>

      {justPaid && b.status === "CONFIRMED" && (
        <div role="status" className="rounded-[16px] bg-ok-bg px-4 py-3 text-[15px] font-semibold text-ok">
          Zahlung erhalten, deine Buchung ist bestätigt. Die Bestätigung kommt auch per E-Mail.
        </div>
      )}

      <div className="card flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-ink-2">{now ? longDate(start) : ""}</div>
            <div className="whitespace-nowrap text-[30px] font-bold leading-[1.1] tracking-[-.04em]">
              {now ? `${hhmm(start)} – ${hhmm(new Date(b.endsAt))}` : ""}
            </div>
            <div className="mt-1 text-[16px] font-semibold">{b.court}</div>
          </div>
          <span className={`pill shrink-0 ${statusCls}`}>{statusText}</span>
        </div>
        {b.total > 0 && (
          <div className="sum">
            <span>
              Betrag{b.paymentMethod ? `, ${PAY[b.paymentMethod] ?? ""}` : ""}
              {b.paymentStatus === "PAID" ? (b.status === "CANCELLED" ? ", zurückerstattet" : ", bezahlt") : ""}
            </span>
            <b>CHF {b.total.toFixed(2)}</b>
          </div>
        )}
        {canCancel ? (
          <button type="button" onClick={cancel} disabled={busy} className={`btn h-12 w-full text-[15px] ${armed ? "bg-bad text-white" : "text-bad"}`}>
            {armed ? "Wirklich stornieren?" : "Buchung stornieren"}
          </button>
        ) : (
          (b.status === "CONFIRMED" || b.status === "PENDING") &&
          now > 0 && (
            <div className="text-[14px] text-ink-2">
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
        <Link href={`/c/${slug}/abos`} className="text-center text-[15px] font-semibold text-brand-deep">
          Öfter hier? Mit Abo ohne Platzgebühr, ab CHF {minPlanPrice}, Saison bis 31. März
        </Link>
      )}
    </div>
  );
}

const Check = () => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-brand-deep">
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
    <form onSubmit={submit} className="card flex flex-col gap-3 p-5">
      <h2 className="text-[20px] font-bold leading-[1.15] tracking-[-.02em]">Nächstes Mal ohne Formular.</h2>
      <p className="text-[15px] text-ink-2">
        Setz ein Passwort – deine E-Mail <span className="font-semibold text-ink">{email}</span> haben wir schon.
      </p>
      <ul className="flex flex-col gap-2 text-[15px] font-semibold">
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
        className={input}
      />
      <button
        type="submit"
        disabled={busy}
        className="btn btn-pri h-[54px] w-full text-[16px]"
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
    <div className="card flex items-center gap-3 px-5 py-4">
      <div className="min-w-0 flex-1 text-[15px]">
        <div className="font-bold">Konto erstellen?</div>
        <div className="truncate text-ink-2">
          {state === "sent" ? `Link ist unterwegs an ${email}` : `Wir schicken dir einen Link an ${email}`}
        </div>
      </div>
      {state !== "sent" && (
        <button
          type="button"
          onClick={send}
          disabled={state === "busy"}
          className="btn h-10 shrink-0"
        >
          Link senden
        </button>
      )}
    </div>
  );
}
