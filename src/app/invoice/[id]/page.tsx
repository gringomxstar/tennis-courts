import { CheckCircle2, Landmark } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/ui/print-button";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const membership = await prisma.membership.findUnique({
    where: { id },
    include: { user: true, plan: true, tenant: true },
  });

  // A membership invoice requires a logged-in owner or tenant admin. A guest booking
  // receipt has no account to check against — see BookingReceipt below for that trust model.
  if (!membership) {
    return <BookingReceipt id={id} />;
  }

  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=/invoice/${id}`);
  }

  const isOwner = membership.user.email.toLowerCase() === session.user.email.toLowerCase();
  const isTenantAdmin = isOwner
    ? false
    : await prisma.tenantUser.findFirst({
        where: {
          tenantId: membership.tenantId,
          user: { email: session.user.email },
          role: { in: ["PLATFORM_ADMIN", "CLUB_ADMIN"] },
        },
      }).then(Boolean);

  if (!isOwner && !isTenantAdmin) {
    notFound();
  }

  const invoiceNumber = `RE-${membership.createdAt.getFullYear()}-${membership.id.slice(-6).toUpperCase()}`;
  const paymentReference = `ABO-${membership.id.slice(-8).toUpperCase()}`;
  const invoiceDate = membership.createdAt.toLocaleDateString("de-CH");
  const dueDate = new Date(membership.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("de-CH");
  const price = Number(membership.plan.price);

  return (
    <div className="min-h-screen bg-background py-12 px-4 selection:bg-clay/30">
      <div className="max-w-2xl mx-auto">

        {/* Success Header */}
        <div className="mb-8 text-center print:hidden">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-clay/10 text-clay mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Abo erfolgreich reserviert!</h1>
          <p className="text-slate-500 mt-2">
            Dein Zugang wird freigeschaltet, sobald die Zahlung bei uns eingegangen ist.
          </p>
        </div>

        {/* Die eigentliche Rechnung (Print-optimiert) */}
        <div className="bg-card text-foreground p-10 md:p-14 rounded-3xl shadow-xl border border-border print:shadow-none print:border-none print:p-0">

          <div className="flex justify-between items-start mb-16">
            <div>
              <h2 className="text-2xl font-black tracking-tighter">{membership.tenant.name}</h2>
              <p className="text-sm text-slate-500 mt-1">{membership.tenant.address || ""}</p>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Rechnung</h3>
              <p className="font-mono text-lg">#{invoiceNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-16">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rechnung an</p>
              <p className="font-medium">{membership.user.firstName} {membership.user.lastName}</p>
              <p className="text-slate-500 text-sm">{membership.user.email}</p>
            </div>
            <div className="text-right">
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Rechnungsdatum</p>
                <p className="font-medium">{invoiceDate}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Zahlbar bis</p>
                <p className="font-medium text-rose-600 dark:text-rose-400">{dueDate}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-b border-slate-200 dark:border-white/[0.1] py-4 mb-8">
            <div className="flex justify-between text-sm font-bold mb-4 px-2 text-slate-400 uppercase tracking-wider">
              <span>Beschreibung</span>
              <span>Betrag</span>
            </div>
            <div className="flex justify-between font-medium text-lg px-2">
              <span>{membership.plan.name}</span>
              <span>{price.toFixed(2)} {membership.plan.currency}</span>
            </div>
          </div>

          <div className="flex justify-end mb-16 px-2">
            <div className="text-right">
              <p className="text-sm text-slate-500 mb-1">Zwischensumme: {price.toFixed(2)} {membership.plan.currency}</p>
              <p className="text-sm text-slate-500 mb-2">MwSt (0%): 0.00 {membership.plan.currency}</p>
              <p className="text-2xl font-black text-clay border-t-2 border-slate-900 dark:border-white pt-2 mt-2">
                Total: {price.toFixed(2)} {membership.plan.currency}
              </p>
            </div>
          </div>

          {/* Zahlungsanweisungen / E-Banking */}
          <div className="bg-slate-50 dark:bg-black/50 rounded-2xl p-6 border border-slate-200 dark:border-white/[0.05]">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <Landmark className="w-4 h-4" /> E-Banking Zahlungsinformationen
            </h4>
            <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <span className="text-slate-500">Bank:</span>
              <span className="font-medium">Freiburger Kantonalbank</span>

              <span className="text-slate-500">IBAN:</span>
              <span className="font-mono font-bold tracking-wide">CH93 0079 0012 3456 7890 1</span>

              <span className="text-slate-500">Zugunsten von:</span>
              <span className="font-medium">{membership.tenant.name}</span>

              <span className="text-slate-500">Mitteilung:</span>
              <span className="font-mono font-bold text-clay bg-clay/10 px-2 py-0.5 rounded">
                {paymentReference}
              </span>
            </div>
          </div>

          {/* Print Button */}
          <div className="mt-12 text-center print:hidden">
             <PrintButton />
             <div className="mt-6">
                <Link href="/" className="text-sm text-slate-500 hover:text-clay underline underline-offset-4">
                  Zurück zum Dashboard
                </Link>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Receipt for a paid court booking (guest or member). Guests have no account to check
// ownership against, so — same trust model as Stripe's own hosted receipt links — the
// unguessable booking id itself is treated as the access key; no login is required here.
async function BookingReceipt({ id }: { id: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { tenant: true, organizer: true, court: true },
  });

  if (!booking) {
    notFound();
  }

  const invoiceNumber = `RE-${booking.createdAt.getFullYear()}-${booking.id.slice(-6).toUpperCase()}`;
  const bookingDate = booking.createdAt.toLocaleDateString("de-CH");
  const startsAt = booking.startsAt.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
  const endsAt = booking.endsAt.toLocaleString("de-CH", { timeStyle: "short" });
  const total = Number(booking.totalCost);
  const isPaid = booking.paymentStatus === "PAID";
  // This page renders without login (see comment above) — mask the email so a leaked/shared
  // link doesn't hand out a full contact address, while still letting the guest recognize
  // their own receipt.
  const [emailUser, emailDomain] = booking.organizer.email.split("@");
  const maskedEmail = emailDomain ? `${emailUser[0] ?? ""}***@${emailDomain}` : booking.organizer.email;

  return (
    <div className="min-h-screen bg-background py-12 px-4 selection:bg-clay/30">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8 text-center print:hidden">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-clay/10 text-clay mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isPaid ? "Zahlung erfolgreich!" : "Buchung erstellt"}
          </h1>
          <p className="text-slate-500 mt-2">
            {isPaid
              ? "Deine Platzreservierung ist bestätigt."
              : "Diese Buchung wartet noch auf die Zahlungsbestätigung."}
          </p>
        </div>

        <div className="bg-card text-foreground p-10 md:p-14 rounded-3xl shadow-xl border border-border print:shadow-none print:border-none print:p-0">

          <div className="flex justify-between items-start mb-16">
            <div>
              <h2 className="text-2xl font-black tracking-tighter">{booking.tenant.name}</h2>
              <p className="text-sm text-slate-500 mt-1">{booking.tenant.address || ""}</p>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Quittung</h3>
              <p className="font-mono text-lg">#{invoiceNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-16">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gebucht von</p>
              <p className="font-medium">{booking.organizer.firstName} {booking.organizer.lastName}</p>
              <p className="text-slate-500 text-sm">{maskedEmail}</p>
            </div>
            <div className="text-right">
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Datum</p>
                <p className="font-medium">{bookingDate}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                <p className={`font-medium ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {isPaid ? "Bezahlt" : "Offen"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-b border-slate-200 dark:border-white/[0.1] py-4 mb-8">
            <div className="flex justify-between text-sm font-bold mb-4 px-2 text-slate-400 uppercase tracking-wider">
              <span>Beschreibung</span>
              <span>Betrag</span>
            </div>
            <div className="flex justify-between font-medium text-lg px-2">
              <span>{booking.court.name} · {startsAt} – {endsAt}</span>
              <span>{total.toFixed(2)} {booking.currency}</span>
            </div>
          </div>

          <div className="flex justify-end mb-4 px-2">
            <div className="text-right">
              <p className="text-2xl font-black text-clay border-t-2 border-slate-900 dark:border-white pt-2 mt-2">
                Total: {total.toFixed(2)} {booking.currency}
              </p>
            </div>
          </div>

          {/* Print Button */}
          <div className="mt-12 text-center print:hidden">
             <PrintButton />
             <div className="mt-6">
                <Link href="/" className="text-sm text-slate-500 hover:text-clay underline underline-offset-4">
                  Zurück zur Startseite
                </Link>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
