import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SwissQRBill } from "swissqrbill/svg";
import { PrintButton } from "@/components/ui/print-button";
import { prisma } from "@/lib/prisma";
import { formatIban } from "@/lib/iban";
import { chf, parseAddress, paymentReference } from "@/lib/sponsoring";
import type { TenantSettings } from "@/types";

/** QR-IBAN from the SIX QR-bill examples; only used for the clearly marked sample bill. */
const SAMPLE_IBAN = "CH4431999123000889012";

export const metadata: Metadata = { title: "Rechnung", robots: { index: false, follow: false } };

/** Sponsor invoice with Swiss QR bill, opened from the personal link (mail, portal, admin card). */
export default async function SponsorInvoicePage({ params }: { params: Promise<{ token: string; invoiceId: string }> }) {
  const { token, invoiceId } = await params;
  const inv = await prisma.sponsorInvoice.findUnique({
    where: { id: invoiceId },
    include: { sponsor: { include: { tenant: true, contacts: true } }, contract: { include: { lines: { include: { item: true } } } } },
  });
  if (!inv || inv.sponsor.token !== token) notFound();
  const s = inv.sponsor;
  const t = s.tenant;
  const clubIban = ((t.settingsJson as TenantSettings | null)?.invoiceIban ?? "").replace(/\s/g, "").toUpperCase();
  const amount = Number(inv.amount);
  const c = inv.contract;
  // what this invoice bills (snapshot); older invoices without snapshot bill the whole contract
  const snap = inv.lines as { lineId: string; name: string; quantity: number; unitPrice: number }[] | null;
  const lines = snap ?? c.lines.map((l) => ({ lineId: l.id, name: l.item.name, quantity: l.quantity, unitPrice: Number(l.unitPrice) }));
  const discountPct = inv.discountPct ?? c.discountPct;
  const addOn = Boolean(snap?.some((x) => c.lines.find((l) => l.id === x.lineId)?.fromYear != null));
  const clubAddress = parseAddress(t.address);
  // Without IBAN + structured club address the bill shows a SAMPLE QR (test IBAN from the SIX examples),
  // marked as such on the page and inside the QR data, so the module can be tried before the club is set up.
  const sample = !clubIban || !clubAddress;
  const iban = sample ? SAMPLE_IBAN : clubIban;
  const creditor = clubAddress ?? { address: "Musterstrasse", buildingNumber: "1", zip: "1234", city: "Musterort" };
  const reference = paymentReference(iban, inv.number);

  let qr = "";
  try {
    qr = new SwissQRBill({
      currency: "CHF",
      amount,
      reference,
      message: sample ? "MUSTER - NICHT EINZAHLEN" : `Sponsoring ${inv.year}, Rechnung ${inv.number}`,
      ...(sample ? { additionalInformation: "Fiktiver Test-QR-Code ohne gueltiges Konto" } : {}),
      creditor: { account: iban, name: (sample ? `MUSTER ${t.name}` : t.name).slice(0, 70), ...creditor, country: "CH" },
      ...(s.zip && s.city ? { debtor: { name: s.name.slice(0, 70), address: s.street ?? "", zip: s.zip, city: s.city, country: "CH" } } : {}),
    }, { language: "DE" }).toString();
  } catch (e) {
    console.error("QR-Rechnung:", e);
  }
  const de = (d: Date) => d.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
  const contact = s.contacts.find((x) => x.isPrimary) ?? s.contacts[0];

  return (
    <main className="mx-auto min-h-[100dvh] max-w-[800px] bg-background px-4 py-8 text-foreground print:max-w-none print:bg-white print:p-0 print:text-black">
      <div className="card p-6 sm:p-10 print:rounded-none print:p-[15mm] print:shadow-none">
        <div className="flex justify-between gap-6 text-[14px]">
          <div>
            <b className="text-[17px]">{t.name}</b>
            <div className="whitespace-pre-line text-ink-2 print:text-black/70">{t.address}</div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-semibold uppercase tracking-[.06em] text-ink-3">{inv.paidAt ? "Bezahlt" : "Rechnung"}</div>
            <div className="text-[22px] font-bold">Nr. {inv.number}</div>
          </div>
        </div>
        <div className="mt-10 text-[15px]">
          <b>{s.name}</b>
          {contact && <div>{contact.name}</div>}
          {s.street && <div>{s.street}</div>}
          {(s.zip || s.city) && <div>{[s.zip, s.city].filter(Boolean).join(" ")}</div>}
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-1 text-[14px] text-ink-2 print:text-black/70">
          <span>Datum: {de(inv.issuedAt)}</span>
          <span>Zahlbar bis: {de(inv.dueAt)}</span>
          {inv.paidAt && <span>Bezahlt am: {de(inv.paidAt)}{inv.paidVia === "stripe" ? " (Karte/Twint)" : ""}</span>}
        </div>
        <h1 className="mt-6 text-[22px] font-bold tracking-[-.02em]">Sponsoring {inv.year}{addOn ? ", Zusatz" : ""}</h1>
        {c.years > 1 && <p className="text-[14px] text-ink-2 print:text-black/70">Vertrag {c.startYear}–{c.startYear + c.years - 1}, Jahr {inv.year - c.startYear + 1} von {c.years}</p>}
        <table className="mt-4 w-full text-[15px]">
          <tbody>
            {lines.map((l) => (
              <tr key={l.lineId} className="border-b border-line">
                <td className="py-2">{l.quantity > 1 ? `${l.quantity}× ` : ""}{l.name}</td>
                <td className="py-2 text-right tabular-nums">{chf(l.quantity * Number(l.unitPrice))}</td>
              </tr>
            ))}
            {discountPct > 0 && (
              <tr className="border-b border-line text-ink-2 print:text-black/70">
                <td className="py-2">Rabatt {c.years} Jahre (−{discountPct} %)</td>
                <td className="py-2 text-right tabular-nums">−{chf(lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0) - amount)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td className="py-3">Total (keine MwSt)</td>
              <td className="py-3 text-right tabular-nums">{chf(amount)}</td>
            </tr>
          </tbody>
        </table>
        {!inv.paidAt && !qr && !sample && (
          <div className="mt-6 grid grid-cols-[120px_1fr] gap-y-1.5 rounded-[16px] bg-bg p-4 text-[14.5px] print:border print:bg-white">
            <span className="text-ink-2">IBAN</span><b>{formatIban(iban)}</b>
            <span className="text-ink-2">Zugunsten von</span><span>{t.name}</span>
            <span className="text-ink-2">Referenz</span><b>{reference}</b>
          </div>
        )}
        {!inv.paidAt && qr && sample && (
          <p role="note" className="mt-8 rounded-[14px] border-2 border-bad bg-bad-bg p-3 text-[14px] font-semibold text-bad print:bg-white">
            MUSTER – fiktiver QR-Zahlteil zum Testen, nicht einzahlen. Der echte Zahlteil erscheint, sobald der Club IBAN und Adresse (Strasse Nr, PLZ Ort) in den Einstellungen hinterlegt.
          </p>
        )}
        {!inv.paidAt && qr && (
          <div className="relative mt-6 print:mt-[20mm]">
            {/* SVG from swissqrbill; sponsor and club texts are escaped by the library */}
            <div className="overflow-x-auto [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-[210mm]" dangerouslySetInnerHTML={{ __html: qr }} />
            {sample && (
              <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <span className="-rotate-[18deg] select-none rounded-[10px] border-4 border-bad/70 px-6 text-[clamp(40px,11vw,96px)] font-black tracking-[.08em] text-bad/45">MUSTER</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mx-auto mt-4 max-w-[360px] print:hidden"><PrintButton /></div>
    </main>
  );
}
