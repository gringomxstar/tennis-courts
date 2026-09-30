import { prisma } from "@/lib/prisma";
import { bookingLink } from "@/lib/booking-link";

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

async function loadBookingForMail(bookingId: string) {
  const b = await prisma.booking
    .findUnique({ where: { id: bookingId }, include: { organizer: true, court: true, tenant: true, participants: { include: { user: true } } } })
    .catch(() => null);
  if (!b) return null;
  const when = b.startsAt.toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    dateStyle: "full",
    timeStyle: "short",
  });
  const end = b.endsAt.toLocaleTimeString("de-CH", { timeZone: "Europe/Zurich", timeStyle: "short" });
  // co-players and guests with an email (the organizer gets his own mail)
  const seen = new Set([b.organizer.email.toLowerCase()]);
  const others: { email: string; firstName: string }[] = [];
  for (const p of b.participants) {
    const email = (p.user?.email ?? p.guestEmail)?.toLowerCase();
    if (p.role === "ORGANIZER" || !email || seen.has(email)) continue;
    seen.add(email);
    others.push({ email, firstName: p.user?.firstName ?? p.guestName ?? "" });
  }
  return { b, slot: `${b.court.name}, ${when} – ${end}`, when, others };
}

const PAY_NOTE: Record<string, string> = {
  ON_SITE: "Bezahlung: vor Ort im Club",
  INVOICE: "Bezahlung: auf Rechnung",
};

export async function sendBookingConfirmation(bookingId: string) {
  const m = await loadBookingForMail(bookingId);
  if (!m) return false;
  const { b } = m;
  const org = b.organizer;
  await Promise.all(m.others.map((o) =>
    sendMail(o.email, `Reservation: ${b.court.name}, ${m.when}`, [
      `Hallo ${o.firstName}`.trim(), "",
      `${org.firstName} ${org.lastName} hat beim ${b.tenant.name} einen Platz für euch reserviert:`,
      m.slot, "",
      `Deine Buchungen: ${appUrl()}/c/${b.tenant.slug}/bookings`,
    ].join("\n"))
  ));
  return sendMail(
    b.organizer.email,
    `Buchung bestätigt: ${b.court.name}, ${m.when}`,
    [
      `Hallo ${b.organizer.firstName}`,
      "",
      `deine Buchung beim ${b.tenant.name} ist bestätigt:`,
      m.slot,
      b.totalCost ? `Betrag: CHF ${Number(b.totalCost).toFixed(2)}` : "",
      b.paymentMethod ? (PAY_NOTE[b.paymentMethod] ?? "") : "",
      b.paymentStatus === "PAID" ? `Quittung: ${appUrl()}/invoice/${b.id}` : "",
      "",
      `Buchung ansehen oder stornieren: ${bookingLink(b.tenant.slug, b.id)}`,
    ].join("\n")
  );
}

export async function sendBookingCancellation(bookingId: string, refund: number) {
  const m = await loadBookingForMail(bookingId);
  if (!m) return false;
  const { b } = m;
  await Promise.all(m.others.map((o) =>
    sendMail(o.email, `Reservation storniert: ${b.court.name}, ${m.when}`, [
      `Hallo ${o.firstName}`.trim(), "",
      `die Reservation beim ${b.tenant.name} wurde storniert:`,
      m.slot,
    ].join("\n"))
  ));
  return sendMail(
    b.organizer.email,
    `Buchung storniert: ${b.court.name}, ${m.when}`,
    [
      `Hallo ${b.organizer.firstName}`,
      "",
      `deine Buchung beim ${b.tenant.name} wurde storniert:`,
      m.slot,
      refund > 0 ? `Rückerstattung: CHF ${refund.toFixed(2)}` : "",
      "",
      `Neu buchen: ${appUrl()}/c/${b.tenant.slug}/calendar`,
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
      `Du kannst sie hier abschliessen: ${appUrl()}/c/${clubSlug}/abos`,
      "",
      "Falls du bereits bezahlt hast, betrachte diese Mail als gegenstandslos.",
    ].join("\n")
  );
}

/** Abo about to end: link to renew the same plan (renewal cron + admin bulk mail). */
export async function sendRenewalReminder(to: string, firstName: string, planName: string, planId: string, endsAt: Date, clubName: string, clubSlug: string) {
  const end = endsAt.toLocaleDateString("de-CH", { day: "numeric", month: "long", timeZone: "Europe/Zurich" });
  return sendMail(to, `Dein Abo läuft am ${end} ab: ${clubName}`, [
    `Hallo ${firstName}`, "",
    `dein Abo «${planName}» beim ${clubName} läuft am ${end} ab.`,
    `Jetzt für die nächste Saison verlängern (Twint oder Karte): ${appUrl()}/c/${clubSlug}/abos?plan=${planId}`,
    "", "Mit «automatisch verlängern» musst du nächstes Jahr nicht mehr daran denken.",
  ].join("\n"));
}

/** Abo paid (Stripe purchase or auto-renewal): receipt link; the invoice itself comes from the club's billing tool. */
export async function sendAboReceipt(to: string, firstName: string, planName: string, clubName: string, membershipId: string) {
  const m = await prisma.membership.findUnique({ where: { id: membershipId }, select: { pricePaid: true } });
  const amount = Number(m?.pricePaid ?? 0);
  return sendMail(to, `Abo bezahlt: ${clubName}`, [
    `Hallo ${firstName}`, "",
    `deine Zahlung für das Abo «${planName}» beim ${clubName} ist eingegangen (CHF ${amount.toFixed(2)}).`,
    `Quittung: ${appUrl()}/invoice/${membershipId}`,
  ].join("\n"));
}

/** Invite (member import) or activation/reset link; url comes from passwordLink(). */
export async function sendPasswordLink(to: string, firstName: string, clubName: string, url: string, kind: "invite" | "reset") {
  const invite = kind === "invite";
  return sendMail(
    to,
    invite ? `Dein Zugang beim ${clubName}` : `Passwort setzen: ${clubName}`,
    [
      `Hallo ${firstName}`,
      "",
      invite
        ? `der ${clubName} bucht Plätze jetzt online. Setz hier dein Passwort, dann kannst du sofort reservieren:`
        : "hier kannst du dein Passwort setzen:",
      url,
      "",
      invite ? "Der Link ist 14 Tage gültig." : "Der Link ist 14 Tage gültig. Falls du das nicht warst, ignoriere diese Mail.",
    ].join("\n")
  );
}
