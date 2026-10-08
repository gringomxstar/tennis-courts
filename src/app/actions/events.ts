"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { getTenantContext } from "@/lib/tenant";
import { eventLink } from "@/lib/booking-link";
import { mainContact } from "@/lib/sponsor-server";
import { blockCourts, cancelEvent, inviteAudience, reply, resolveAudience } from "@/lib/events-server";

type Res<T = object> = ({ success: true } & T) | { success: false; error: string };
const fail = (e: unknown): { success: false; error: string } => ({ success: false, error: e instanceof Error ? e.message : String(e) });

async function admin(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx.isTenantAdmin || !ctx.user) throw new Error("Keine Berechtigung.");
  return { tenantId: ctx.tenant.id, actorId: ctx.user.id, tenantName: ctx.tenant.name };
}
const refresh = (slug: string) => revalidatePath(`/c/${slug}/admin/events`, "layout");

async function ownEvent(tenantId: string, id: string) {
  const e = await prisma.event.findFirst({ where: { id, tenantId } });
  if (!e) throw new Error("Anlass nicht gefunden.");
  return e;
}

const TZ = "Europe/Zurich";
/** "2026-10-08" + "18:00" in Zürcher Zeit → Date (Sommer-/Winterzeit via Intl). */
function zurich(day: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Datum oder Zeit ungültig.");
  const guess = Date.parse(`${day}T${time}:00Z`);
  const off = (t: number) => Date.parse(new Date(t).toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T") + "Z") - t;
  const first = guess - off(guess);
  return new Date(guess - off(first));
}
const when = (d: Date) => d.toLocaleString("de-CH", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });

export type Audience = { members: boolean; planIds?: string[]; sponsors: boolean };
export type EventInput = {
  id?: string; kind: string; title: string; date: string; time: string; endTime: string;
  location: string; description: string; priceNote: string; deadline: string;
  maxSeats: number | null; maxPlusOnes: number; courtIds: string[]; mailMembers: boolean;
};

export async function saveEventAction(slug: string, i: EventInput): Promise<Res<{ id: string; conflict: string | null }>> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const title = i.title.trim();
    if (!title) throw new Error("Titel fehlt.");
    const startsAt = zurich(i.date, i.time);
    const endsAt = zurich(i.date, i.endTime);
    if (endsAt <= startsAt) throw new Error("Das Ende muss nach dem Beginn liegen.");
    const maxSeats = i.maxSeats && i.maxSeats > 0 ? Math.floor(i.maxSeats) : null;
    const maxPlusOnes = Math.min(10, Math.max(0, Math.floor(i.maxPlusOnes) || 0));
    const data = {
      title, kind: i.kind || "leer", startsAt, endsAt, maxSeats, maxPlusOnes, mailMembers: i.mailMembers,
      location: i.location.trim() || null, description: i.description.trim() || null, priceNote: i.priceNote.trim() || null,
      deadline: i.deadline ? zurich(i.deadline, "23:59") : null,
    };
    let id = i.id;
    if (id) {
      const e = await ownEvent(tenantId, id);
      if (e.cancelledAt) throw new Error("Der Anlass ist abgesagt.");
      await prisma.event.update({ where: { id }, data });
    } else {
      id = (await prisma.event.create({ data: { ...data, tenantId, createdById: actorId } })).id;
    }
    // nur gültige Plätze des Clubs
    const courts = i.courtIds.length ? await prisma.court.findMany({ where: { tenantId, id: { in: i.courtIds } }, select: { id: true } }) : [];
    const { conflict } = await blockCourts(id, courts.map((c) => c.id));
    refresh(slug);
    return { success: true, id, conflict };
  } catch (e) {
    return fail(e);
  }
}

export async function previewAudienceAction(slug: string, a: Audience, mailMembers: boolean, eventId?: string): Promise<Res<{ members: number; sponsors: number; noEmail: number; mails: number }>> {
  try {
    const { tenantId } = await admin(slug);
    let rec = await resolveAudience(tenantId, a);
    // bereits Eingeladene nicht doppelt zählen; noch nicht Versandte werden beim Einladen mitgeschickt
    const old = eventId ? await prisma.eventInvite.findMany({ where: { eventId, event: { tenantId } } }) : [];
    const known = new Set(old.map((i) => (i.userId ? `u:${i.userId}` : `s:${i.sponsorId}`)));
    rec = rec.filter((r) => !known.has(r.userId ? `u:${r.userId}` : `s:${r.sponsorId}`));
    const sponsors = rec.filter((r) => r.sponsorId).length;
    const mailable = (email: string | null, sponsor: boolean) => Boolean(email) && (sponsor || mailMembers);
    return {
      success: true, sponsors, members: rec.length - sponsors, noEmail: rec.filter((r) => !r.email).length,
      mails: rec.filter((r) => mailable(r.email, Boolean(r.sponsorId))).length + old.filter((i) => !i.sentAt && mailable(i.email, Boolean(i.sponsorId))).length,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function inviteAction(slug: string, eventId: string, a: Audience, mailMembers?: boolean): Promise<Res<{ invited: number; mailed: number; skippedNoEmail: number }>> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const e = await ownEvent(tenantId, eventId);
    if (e.cancelledAt) throw new Error("Der Anlass ist abgesagt.");
    if (mailMembers !== undefined && mailMembers !== e.mailMembers) await prisma.event.update({ where: { id: eventId }, data: { mailMembers } });
    const r = await inviteAudience(eventId, a, actorId);
    refresh(slug);
    return { success: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

/** Admin setzt die Antwort von Hand; Plätze und Warteliste gelten wie sonst, nur der Anmeldeschluss nicht. */
export async function setReplyAction(slug: string, inviteId: string, value: "YES" | "NO"): Promise<Res<{ reply: string; promoted: number }>> {
  try {
    const { tenantId } = await admin(slug);
    const inv = await prisma.eventInvite.findFirst({ where: { id: inviteId, event: { tenantId } } });
    if (!inv) throw new Error("Einladung nicht gefunden.");
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: inv.eventId }, select: { maxPlusOnes: true } });
    const r = await reply(inviteId, value, Math.min(inv.plusOnes, ev.maxPlusOnes), undefined, { ignoreDeadline: true });
    refresh(slug);
    return { success: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

type MailEvent = { title: string; startsAt: Date; location: string | null; priceNote: string | null; deadline: Date | null };
const details = (e: MailEvent) =>
  [`Wann: ${when(e.startsAt)}`, e.location && `Wo: ${e.location}`, e.priceNote && `Kosten: ${e.priceNote}`, e.deadline && `Anmeldeschluss: ${when(e.deadline)}`].filter(Boolean).join("\n");

/** Mail an Offene (mit E-Mail; Mitglieder nur bei «per Mail»). inviteIds leer = alle Offenen. */
export async function remindOpenAction(slug: string, eventId: string, inviteIds?: string[]): Promise<Res<{ sent: number }>> {
  try {
    const { tenantId } = await admin(slug);
    const e = await ownEvent(tenantId, eventId);
    if (e.cancelledAt) throw new Error("Der Anlass ist abgesagt.");
    const open = await prisma.eventInvite.findMany({ where: { eventId, reply: "INVITED", ...(inviteIds?.length ? { id: { in: inviteIds } } : {}) } });
    let sent = 0;
    for (const i of open) {
      if (!i.email || (i.userId && !e.mailMembers)) continue;
      if (await sendMail(i.email, `Erinnerung: ${e.title}`, `Guten Tag ${i.name}\n\nBitte antworten Sie auf die Einladung: ${e.title}\n\n${details(e)}\n\n${eventLink(i.id)}\n`)) {
        await prisma.eventInvite.update({ where: { id: i.id }, data: { remindedAt: new Date() } });
        sent++;
      }
    }
    refresh(slug);
    return { success: true, sent };
  } catch (e) {
    return fail(e);
  }
}

/** Einzelnes Mitglied (u:ID) oder einen Sponsor (s:ID) nachträglich einladen. */
export async function addPersonAction(slug: string, eventId: string, key: string): Promise<Res<{ mailed: boolean }>> {
  try {
    const { tenantId, tenantName } = await admin(slug);
    const e = await ownEvent(tenantId, eventId);
    if (e.cancelledAt) throw new Error("Der Anlass ist abgesagt.");
    const [kind, id] = key.split(":");
    let who: { userId?: string; sponsorId?: string; email: string | null; name: string };
    if (kind === "u") {
      const t = await prisma.tenantUser.findFirst({ where: { tenantId, userId: id }, include: { user: true } });
      if (!t) throw new Error("Mitglied nicht gefunden.");
      who = { userId: id, email: t.user.email, name: `${t.user.firstName} ${t.user.lastName}`.trim() };
    } else {
      const s = await prisma.sponsor.findFirst({ where: { id, tenantId }, include: { contacts: true } });
      if (!s) throw new Error("Sponsor nicht gefunden.");
      who = { sponsorId: id, email: mainContact(s)?.email ?? null, name: mainContact(s)?.name || s.name };
    }
    if (await prisma.eventInvite.findFirst({ where: { eventId, ...(who.userId ? { userId: who.userId } : { sponsorId: who.sponsorId }) } })) throw new Error("Bereits eingeladen.");
    const inv = await prisma.eventInvite.create({ data: { eventId, userId: who.userId ?? null, sponsorId: who.sponsorId ?? null, email: who.email, name: who.name } });
    let mailed = false;
    if (who.email && (who.sponsorId || e.mailMembers)) {
      mailed = await sendMail(who.email, `Einladung: ${e.title}`, `Guten Tag ${who.name}\n\n${tenantName} lädt Sie ein: ${e.title}\n\n${details(e)}\n\nZu- oder Absage hier:\n${eventLink(inv.id)}\n`);
      if (mailed) await prisma.eventInvite.update({ where: { id: inv.id }, data: { sentAt: new Date() } });
    }
    refresh(slug);
    return { success: true, mailed };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelEventAction(slug: string, eventId: string): Promise<Res> {
  try {
    const { tenantId } = await admin(slug);
    const e = await ownEvent(tenantId, eventId);
    if (e.cancelledAt) throw new Error("Bereits abgesagt.");
    await cancelEvent(eventId);
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEventAction(slug: string, eventId: string): Promise<Res> {
  try {
    const { tenantId } = await admin(slug);
    await ownEvent(tenantId, eventId);
    await prisma.event.delete({ where: { id: eventId } }); // Einladungen und Sperren fallen per Cascade
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}
