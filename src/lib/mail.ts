import { prisma } from "@/lib/prisma";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Transaktionale Mail über Brevo (Gratis: 300/Tag). Ohne BREVO_API_KEY/MAIL_FROM
 * wird nichts versendet — die App läuft normal weiter. Wirft nie.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    console.warn(`Mailversand übersprungen (BREVO_API_KEY/MAIL_FROM fehlt): ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: from, name: process.env.MAIL_FROM_NAME || "TennisCourts" },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) console.error(`Brevo-Fehler ${res.status}: ${await res.text()}`);
    return res.ok;
  } catch (e) {
    console.error("Mailversand fehlgeschlagen:", e);
    return false;
  }
}

export async function sendBookingConfirmation(bookingId: string) {
  const b = await prisma.booking
    .findUnique({ where: { id: bookingId }, include: { organizer: true, court: true, tenant: true } })
    .catch(() => null);
  if (!b) return false;
  const when = b.startsAt.toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    dateStyle: "full",
    timeStyle: "short",
  });
  const end = b.endsAt.toLocaleTimeString("de-CH", { timeZone: "Europe/Zurich", timeStyle: "short" });
  return sendMail(
    b.organizer.email,
    `Buchung bestätigt: ${b.court.name}, ${when}`,
    [
      `Hallo ${b.organizer.firstName}`,
      "",
      `deine Buchung beim ${b.tenant.name} ist bestätigt:`,
      `${b.court.name}, ${when} – ${end}`,
      b.totalCost ? `Betrag: CHF ${Number(b.totalCost).toFixed(2)}` : "",
      "",
      `Deine Buchungen: ${appUrl()}/c/${b.tenant.slug}/bookings`,
    ].join("\n")
  );
}

export async function sendPaymentReminder(to: string, firstName: string, clubName: string, clubSlug: string) {
  return sendMail(
    to,
    `Zahlungserinnerung: Mitgliedschaft ${clubName}`,
    [
      `Hallo ${firstName}`,
      "",
      `für deine Mitgliedschaft beim ${clubName} ist noch keine Zahlung eingegangen.`,
      `Du kannst sie hier abschliessen: ${appUrl()}/c/${clubSlug}/profile?abo=1`,
      "",
      "Falls du bereits bezahlt hast, betrachte diese Mail als gegenstandslos.",
    ].join("\n")
  );
}
