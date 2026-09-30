import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/ui/print-button";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatIban } from "@/lib/iban";
import type { TenantSettings } from "@/types";

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
  // the amount at purchase, not today's plan price
  const price = Number(membership.pricePaid ?? membership.plan.price);
  const paid = membership.status === "ACTIVE" || membership.status === "EXPIRED";
  const s = membership.tenant.settingsJson as TenantSettings | null;

  const cur = membership.plan.currency;
  return (
    <InvoiceLayout
      title={paid ? "Bezahlt." : "Reserviert."}
      subtitle={paid ? "Danke, die Zahlung ist eingegangen." : "Dein Zugang wird freigeschaltet, sobald die Zahlung bei uns eingegangen ist."}
      clubName={membership.tenant.name}
      clubAddress={membership.tenant.address}
      docLabel="Rechnung"
      number={invoiceNumber}
      toLabel="Rechnung an"
      toName={`${membership.user.firstName} ${membership.user.lastName}`}
      toEmail={membership.user.email}
      meta={[
        ["Rechnungsdatum", invoiceDate],
        ["Zahlbar bis", dueDate],
      ]}
      item={membership.plan.name}
      amount={`${price.toFixed(2)} ${cur}`}
      totals={[
        ["Zwischensumme", `${price.toFixed(2)} ${cur}`],
        ["MwSt (0%)", `0.00 ${cur}`],
      ]}
    >
      {!paid && s?.invoiceIban && (
      <div className="mt-6 rounded-[16px] bg-bg p-4 print:rounded-none print:border print:border-black/20 print:bg-white">
        <div className="text-[12.5px] font-semibold text-ink-3 print:text-black/60">
          E-Banking Zahlungsinformationen
        </div>
        <div className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-[15px]">
          <span className="text-ink-2 print:text-black/60">Bank</span>
          <span className="font-semibold">{s.invoiceBank || "–"}</span>
          <span className="text-ink-2 print:text-black/60">IBAN</span>
          <span className="font-bold tracking-wide">{formatIban(s.invoiceIban)}</span>
          <span className="text-ink-2 print:text-black/60">Zugunsten von</span>
          <span className="font-semibold">{membership.tenant.name}</span>
          <span className="text-ink-2 print:text-black/60">Mitteilung</span>
          <span className="font-bold text-brand-deep print:text-black">{paymentReference}</span>
        </div>
      </div>
      )}
    </InvoiceLayout>
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
    <InvoiceLayout
      title={isPaid ? "Bezahlt." : "Gebucht."}
      subtitle={isPaid ? "Deine Platzreservierung ist bestätigt." : "Diese Buchung wartet noch auf die Zahlungsbestätigung."}
      clubName={booking.tenant.name}
      clubAddress={booking.tenant.address}
      docLabel="Quittung"
      number={invoiceNumber}
      toLabel="Gebucht von"
      toName={`${booking.organizer.firstName} ${booking.organizer.lastName}`}
      toEmail={maskedEmail}
      meta={[
        ["Datum", bookingDate],
        ["Status", isPaid ? "Bezahlt" : "Offen"],
      ]}
      item={`${booking.court.name} · ${startsAt} – ${endsAt}`}
      amount={`${total.toFixed(2)} ${booking.currency}`}
      totals={[]}
    />
  );
}

const label = "text-[12.5px] font-semibold text-ink-3 print:text-black/60";

// Shared markup: card on screen, plain white sheet on paper (header, buttons and chrome hidden).
function InvoiceLayout(p: {
  title: string;
  subtitle: string;
  clubName: string;
  clubAddress?: string | null;
  docLabel: string;
  number: string;
  toLabel: string;
  toName: string;
  toEmail: string;
  meta: [string, string][];
  item: string;
  amount: string;
  totals: [string, string][];
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-bg px-5 pb-16 pt-10 text-ink sm:pt-16 print:min-h-0 print:bg-white print:p-0 print:text-black">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="print:hidden">
          <h1 className="text-[28px] font-bold tracking-[-.03em] sm:text-[32px]">{p.title}</h1>
          <div className="mt-1 text-[14px] text-ink-2">{p.subtitle}</div>
        </div>

        <div className="card mt-5 p-6 sm:p-9 print:mt-0 print:rounded-none print:bg-white print:p-0 print:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[20px] font-bold tracking-[-.02em]">{p.clubName}</div>
              {p.clubAddress && <div className="mt-0.5 text-[14px] text-ink-2 print:text-black/60">{p.clubAddress}</div>}
            </div>
            <div className="text-right">
              <div className={label}>{p.docLabel}</div>
              <div className="mt-0.5 text-[15px] font-semibold">Nr. {p.number}</div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <div>
              <div className={label}>{p.toLabel}</div>
              <div className="mt-1.5 text-[16px] font-semibold">{p.toName}</div>
              <div className="text-[14px] text-ink-2 print:text-black/60">{p.toEmail}</div>
            </div>
            <div className="flex flex-col gap-3 text-right">
              {p.meta.map(([k, v]) => (
                <div key={k}>
                  <div className={label}>{k}</div>
                  <div className="mt-0.5 text-[16px] font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 border-y border-line py-4 print:border-black/20">
            <div className={`flex justify-between ${label}`}>
              <span>Beschreibung</span>
              <span>Betrag</span>
            </div>
            <div className="mt-3 flex justify-between gap-4 text-[16px] font-semibold">
              <span>{p.item}</span>
              <span className="shrink-0">{p.amount}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col items-end gap-1 text-[14px] text-ink-2 print:text-black/60">
            {p.totals.map(([k, v]) => (
              <div key={k}>
                {k}: {v}
              </div>
            ))}
            <div className="mt-1 text-[22px] font-bold tracking-[-.02em] text-ink print:text-black">Total: {p.amount}</div>
          </div>

          {p.children}

          <div className="mt-8 print:hidden">
            <PrintButton />
            <Link href="/" className="mt-4 block text-center text-[15px] font-semibold text-brand-deep">
              Zurück zur Startseite
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
