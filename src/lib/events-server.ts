import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { eventLink } from "@/lib/booking-link";
import { mainContact } from "@/lib/sponsor-server";
import { applyReply, type EventReplyValue } from "@/lib/events";

const TZ = "Europe/Zurich";
const DAY = 86_400_000;
const when = (d: Date) => d.toLocaleString("de-CH", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
const zurichDay = (d: Date) => Date.parse(d.toLocaleDateString("sv-SE", { timeZone: TZ }));
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** A block over live bookings would leave paid slots on an unusable court: the admin cancels those first. */
export async function bookingsInBlocks(tenantId: string, items: { courtId: string; startsAt: Date; endsAt: Date }[]) {
  const n = await prisma.booking.count({
    where: {
      tenantId,
      status: { in: ["CONFIRMED", "PENDING"] },
      OR: items.map((i) => ({ courtId: i.courtId, startsAt: { lt: i.endsAt }, endsAt: { gt: i.startsAt } })),
    },
  });
  return n ? `Im Zeitraum gibt es noch ${n} Buchung${n === 1 ? "" : "en"}. Bitte zuerst stornieren, dann sperren.` : null;
}

export type Recipient = { userId?: string; sponsorId?: string; email: string | null; name: string };

/** Wer eingeladen wird: Mitglieder (nicht GUEST, optional mit aktivem Abo der Pläne) und Sponsoren (Hauptkontakt). */
export async function resolveAudience(tenantId: string, a: { members: boolean; planIds?: string[]; sponsors: boolean }): Promise<Recipient[]> {
  const out: Recipient[] = [];
  if (a.members) {
    const tus = await prisma.tenantUser.findMany({
      where: {
        tenantId, role: { not: "GUEST" }, status: "ACTIVE",
        ...(a.planIds?.length ? { user: { memberships: { some: { tenantId, status: "ACTIVE", membershipPlanId: { in: a.planIds } } } } } : {}),
      },
      include: { user: true },
    });
    for (const t of tus) out.push({ userId: t.userId, email: t.user.email, name: `${t.user.firstName} ${t.user.lastName}`.trim() });
  }
  if (a.sponsors) {
    const sps = await prisma.sponsor.findMany({ where: { tenantId }, include: { contacts: true } });
    for (const s of sps) out.push({ sponsorId: s.id, email: mainContact(s)?.email ?? null, name: mainContact(s)?.name || s.name });
  }
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = r.userId ? `u:${r.userId}` : `s:${r.sponsorId}`;
    return !seen.has(k) && seen.add(k);
  });
}

const details = (e: { title: string; startsAt: Date; location: string | null; priceNote: string | null; deadline: Date | null }) =>
  [`Wann: ${when(e.startsAt)}`, e.location && `Wo: ${e.location}`, e.priceNote && `Kosten: ${e.priceNote}`, e.deadline && `Anmeldeschluss: ${when(e.deadline)}`]
    .filter(Boolean).join("\n");

/** Legt Einladungen an (Duplikate werden übersprungen) und verschickt sofort. Mitglieder nur, wenn event.mailMembers. */
export async function inviteAudience(eventId: string, audience: { members: boolean; planIds?: string[]; sponsors: boolean }, actorId: string) {
  void actorId; // ponytail: kein Audit-Eintrag in WP0, Aufrufer (Action) loggt
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { tenant: true } });
  const rec = await resolveAudience(event.tenantId, audience);
  await prisma.eventInvite.createMany({
    data: rec.map((r) => ({ eventId, userId: r.userId ?? null, sponsorId: r.sponsorId ?? null, email: r.email, name: r.name })),
    skipDuplicates: true,
  });
  const invites = await prisma.eventInvite.findMany({ where: { eventId, sentAt: null } });
  let mailed = 0, skippedNoEmail = 0;
  for (const i of invites) {
    if (i.userId && !event.mailMembers) continue; // nur in der App
    if (!i.email) { skippedNoEmail++; continue; }
    const ok = await sendMail(
      i.email, `Einladung: ${event.title}`,
      `Guten Tag ${i.name}\n\n${event.tenant.name} lädt Sie ein: ${event.title}\n\n${details(event)}\n\nZu- oder Absage hier:\n${eventLink(i.id)}\n`
    );
    if (ok) { mailed++; await prisma.eventInvite.update({ where: { id: i.id }, data: { sentAt: new Date() } }); }
  }
  return { invited: rec.length, mailed, skippedNoEmail };
}

/** Zu-/Absage unter Event-Lock; schreibt Zustände und benachrichtigt Nachgerückte. */
export async function reply(inviteId: string, replyValue: "YES" | "NO", plusOnes: number, comment?: string | null, opts?: { ignoreDeadline?: boolean }) {
  const inv0 = await prisma.eventInvite.findUniqueOrThrow({ where: { id: inviteId }, select: { eventId: true } });
  const now = new Date();
  const res = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"event:" + inv0.eventId}))`;
    const event = await tx.event.findUniqueOrThrow({ where: { id: inv0.eventId }, include: { invites: true } });
    if (event.cancelledAt) throw new Error("Der Anlass wurde abgesagt.");
    const r = applyReply(opts?.ignoreDeadline ? { ...event, deadline: null } : event, event.invites, inviteId, replyValue, plusOnes, now);
    for (const n of r.invites) {
      const o = event.invites.find((x) => x.id === n.id)!;
      if (o.reply === n.reply && o.plusOnes === n.plusOnes && o.respondedAt?.getTime() === n.respondedAt?.getTime()) continue;
      await tx.eventInvite.update({
        where: { id: n.id },
        data: { reply: n.reply, plusOnes: n.plusOnes, respondedAt: n.respondedAt, ...(n.id === inviteId ? { comment: comment?.trim() || null } : {}) },
      });
    }
    const mine = r.invites.find((i) => i.id === inviteId)!;
    return { event, reply: mine.reply as EventReplyValue, promoted: event.invites.filter((i) => r.promoted.includes(i.id)) };
  });
  for (const p of res.promoted) {
    if (!p.email || (p.userId && !res.event.mailMembers)) continue;
    await sendMail(p.email, `Du bist dabei: ${res.event.title}`, `Guten Tag ${p.name}\n\nEs ist ein Platz frei geworden, Sie sind dabei: ${res.event.title}\n\n${details(res.event)}\n\nAntwort ändern:\n${eventLink(p.id)}\n`);
  }
  return { reply: res.reply, promoted: res.promoted.length };
}

const mailable = (i: { email: string | null; userId: string | null }, e: { mailMembers: boolean }) => Boolean(i.email) && (!i.userId || e.mailMembers);

/** Cron: (a) einmalige Erinnerung an Offene ≤2 Tage vor Anmeldeschluss, (b) «Morgen»-Mail an Zusagen. */
export async function runEvents(now = new Date()) {
  let reminded = 0, tomorrow = 0;
  const open = await prisma.eventInvite.findMany({
    where: { reply: "INVITED", remindedAt: null, event: { cancelledAt: null, deadline: { gt: now, lte: new Date(now.getTime() + 2 * DAY) } } },
    include: { event: true },
  });
  for (const i of open) {
    if (!mailable(i, i.event)) continue;
    if (await sendMail(i.email!, `Erinnerung: ${i.event.title}`, `Guten Tag ${i.name}\n\nBitte antworten Sie bis ${when(i.event.deadline!)}: ${i.event.title}\n\n${details(i.event)}\n\n${eventLink(i.id)}\n`)) {
      await prisma.eventInvite.update({ where: { id: i.id }, data: { remindedAt: now } });
      reminded++;
    }
  }
  const yes = await prisma.eventInvite.findMany({
    where: { reply: "YES", dayBeforeSentAt: null, event: { cancelledAt: null, startsAt: { gt: now, lte: new Date(now.getTime() + 3 * DAY) } } },
    include: { event: true },
  });
  for (const i of yes) {
    if (zurichDay(i.event.startsAt) - zurichDay(now) !== DAY || !mailable(i, i.event)) continue;
    const ics = `${appUrl()}/e/${i.id}/ics?t=${new URL(eventLink(i.id)).searchParams.get("t")}`;
    if (await sendMail(i.email!, `Morgen: ${i.event.title}`, `Guten Tag ${i.name}\n\nMorgen ist es soweit: ${i.event.title}\n\n${details(i.event)}\n\nIn den Kalender: ${ics}\n`)) {
      await prisma.eventInvite.update({ where: { id: i.id }, data: { dayBeforeSentAt: now } });
      tomorrow++;
    }
  }
  return { reminded, tomorrow };
}

/** Absage: Sperren weg, Zusagen und Wartende per Mail informieren. */
export async function cancelEvent(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { invites: { where: { reply: { in: ["YES", "WAITLIST"] } } } } });
  await prisma.$transaction([
    prisma.event.update({ where: { id: eventId }, data: { cancelledAt: new Date() } }),
    prisma.courtBlock.deleteMany({ where: { eventId } }),
  ]);
  for (const i of event.invites) {
    if (mailable(i, event)) await sendMail(i.email!, `Abgesagt: ${event.title}`, `Guten Tag ${i.name}\n\nLeider muss der Anlass «${event.title}» (${when(event.startsAt)}) abgesagt werden.\n`);
  }
}

/** Plätze für den Anlass sperren. Bei Buchungen im Zeitraum wird nichts gesperrt und der Konflikt gemeldet. */
export async function blockCourts(eventId: string, courtIds: string[]) {
  const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const items = courtIds.map((courtId) => ({ courtId, startsAt: e.startsAt, endsAt: e.endsAt }));
  const conflict = items.length ? await bookingsInBlocks(e.tenantId, items) : null;
  if (conflict) return { blocked: 0, conflict };
  await prisma.$transaction([
    prisma.courtBlock.deleteMany({ where: { eventId } }),
    prisma.courtBlock.createMany({ data: items.map((i) => ({ ...i, tenantId: e.tenantId, reason: "EVENT" as const, description: e.title, eventId, createdById: e.createdById })) }),
  ]);
  return { blocked: items.length, conflict: null };
}
