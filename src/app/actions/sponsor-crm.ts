"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { getTenantContext } from "@/lib/tenant";
import { STAGES, fillPlaceholders, type Stage } from "@/lib/sponsoring";
import { logSponsor, mainContact } from "@/lib/sponsor-server";

type Res<T = object> = ({ success: true } & T) | { success: false; error: string };
const fail = (e: unknown): { success: false; error: string } => ({ success: false, error: e instanceof Error ? e.message : String(e) });

async function admin(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx.isTenantAdmin || !ctx.user) throw new Error("Keine Berechtigung.");
  return { tenantId: ctx.tenant.id, actorId: ctx.user.id };
}
const refresh = (slug: string) => revalidatePath(`/c/${slug}/admin/sponsoring`, "layout");

async function ownSponsor(tenantId: string, sponsorId: string) {
  const s = await prisma.sponsor.findFirst({ where: { id: sponsorId, tenantId } });
  if (!s) throw new Error("Sponsor nicht gefunden.");
  return s;
}
async function ownNote(tenantId: string, noteId: string) {
  const n = await prisma.sponsorNote.findFirst({ where: { id: noteId, sponsor: { tenantId } } });
  if (!n) throw new Error("Notiz nicht gefunden.");
  return n;
}
async function ownFile(tenantId: string, fileId: string) {
  const f = await prisma.sponsorFile.findFirst({ where: { id: fileId, sponsor: { tenantId } }, select: { id: true, sponsorId: true, name: true } });
  if (!f) throw new Error("Datei nicht gefunden.");
  return f;
}

const cleanText = (t: string) => {
  const v = t.trim();
  if (!v) throw new Error("Text fehlt.");
  if (v.length > 4000) throw new Error("Text zu lang (max. 4000 Zeichen).");
  return v;
};
const parseDay = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("Datum ungültig.");
  return d;
};

export async function addNoteAction(slug: string, sponsorId: string, text: string, followUpAt?: string | null): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    await ownSponsor(tenantId, sponsorId);
    await prisma.sponsorNote.create({ data: { sponsorId, authorId: actorId, text: cleanText(text), followUpAt: parseDay(followUpAt) } });
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateNoteAction(slug: string, noteId: string, text: string, followUpAt?: string | null): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const n = await ownNote(tenantId, noteId);
    if (n.authorId !== actorId) throw new Error("Nur der Autor kann die Notiz ändern.");
    const at = parseDay(followUpAt);
    await prisma.sponsorNote.update({
      where: { id: noteId },
      data: { text: cleanText(text), followUpAt: at, followUpDoneAt: at && n.followUpAt?.getTime() === at.getTime() ? n.followUpDoneAt : null },
    });
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNoteAction(slug: string, noteId: string): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const n = await ownNote(tenantId, noteId);
    if (n.authorId !== actorId) throw new Error("Nur der Autor kann die Notiz löschen.");
    await prisma.sponsorNote.delete({ where: { id: noteId } });
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function completeFollowUpAction(slug: string, noteId: string): Promise<Res> {
  try {
    const { tenantId } = await admin(slug);
    await ownNote(tenantId, noteId);
    await prisma.sponsorNote.update({ where: { id: noteId }, data: { followUpDoneAt: new Date() } });
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setStageAction(slug: string, sponsorId: string, stage: Stage): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const label = STAGES.find((s) => s.value === stage)?.label;
    if (!label) throw new Error("Stufe ungültig.");
    await ownSponsor(tenantId, sponsorId);
    await prisma.sponsor.update({ where: { id: sponsorId }, data: { stage } });
    await logSponsor(tenantId, sponsorId, actorId, `Stufe: ${label}`);
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

const MAX_PDF = 3 * 1024 * 1024;

export async function uploadSponsorFileAction(slug: string, sponsorId: string, form: FormData): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    await ownSponsor(tenantId, sponsorId);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Bitte eine Datei wählen.");
    if (file.size > MAX_PDF) throw new Error("Datei grösser als 3 MB.");
    if (file.type !== "application/pdf") throw new Error("Nur PDF-Dateien erlaubt.");
    const name = file.name.replace(/[\r\n"]/g, "").slice(0, 120) || "Datei.pdf";
    await prisma.sponsorFile.create({ data: { sponsorId, name, type: file.type, size: file.size, data: new Uint8Array(await file.arrayBuffer()), uploadedById: actorId } });
    await logSponsor(tenantId, sponsorId, actorId, `Datei hochgeladen: ${name}`);
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSponsorFileAction(slug: string, fileId: string): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const f = await ownFile(tenantId, fileId);
    await prisma.sponsorFile.delete({ where: { id: fileId } });
    await logSponsor(tenantId, f.sponsorId, actorId, `Datei gelöscht: ${f.name}`);
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

const MAX_BULK = 200;

/** One mail per sponsor to the main contact; sponsors without e-mail are skipped (company names returned). */
export async function sendBulkMailAction(slug: string, sponsorIds: string[], subject: string, body: string): Promise<Res<{ sent: number; skipped: string[] }>> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const ids = [...new Set(sponsorIds)];
    if (!ids.length) throw new Error("Keine Empfänger gewählt.");
    if (ids.length > MAX_BULK) throw new Error(`Maximal ${MAX_BULK} Empfänger pro Versand.`);
    if (!subject.trim() || !body.trim()) throw new Error("Betreff und Text fehlen.");
    const sponsors = await prisma.sponsor.findMany({ where: { id: { in: ids }, tenantId }, include: { contacts: true } });
    let sent = 0;
    const skipped: string[] = [];
    for (const s of sponsors) {
      const c = mainContact(s);
      if (!c?.email) { skipped.push(s.name); continue; }
      const v = { firma: s.name, vorname: c.name.trim().split(/\s+/)[0] || null };
      const subj = fillPlaceholders(subject.trim(), v);
      if (!(await sendMail(c.email, subj, fillPlaceholders(body, v)))) { skipped.push(s.name); continue; }
      await logSponsor(tenantId, s.id, actorId, `Mail: ${subj}`);
      sent++;
    }
    refresh(slug);
    return { success: true, sent, skipped };
  } catch (e) {
    return fail(e);
  }
}
