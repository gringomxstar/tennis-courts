"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { getStripe } from "@/lib/stripe";
import { getTenantContext } from "@/lib/tenant";
import { coversYear, chf } from "@/lib/sponsoring";
import { parseSponsors } from "@/lib/sponsor-import";
import { CHECKOUT_MINUTES, NO_ANSWER, billYear, buyItems, confirmPurchase, settleOwnCheckouts, currentSponsorYear, logSponsor, newSponsorToken, sendInvoiceMailWhy, startCampaign } from "@/lib/sponsor-server";

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

// ---------- Sponsorenkartei ----------

const sponsorSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Firma fehlt").max(120),
  street: z.string().trim().max(120).optional(),
  zip: z.string().trim().max(10).optional(),
  city: z.string().trim().max(60).optional(),
  website: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  ownerId: z.string().optional(),
  contacts: z.array(z.object({
    name: z.string().trim().max(120),
    email: z.string().trim().toLowerCase().max(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-Mail ungültig").optional(),
    phone: z.string().trim().max(30).optional(),
    role: z.string().trim().max(60).optional(),
    isPrimary: z.boolean(),
  })).max(10),
});

export async function saveSponsorAction(slug: string, input: z.input<typeof sponsorSchema>): Promise<Res<{ id: string }>> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const d = sponsorSchema.parse(input);
    if (d.ownerId && !(await prisma.tenantUser.findFirst({ where: { tenantId, userId: d.ownerId } }))) throw new Error("Vorstandsmitglied gehört nicht zum Club.");
    const contacts = d.contacts.filter((c) => c.name || c.email).map((c, i, all) => ({
      name: c.name || c.email!, email: c.email || null, phone: c.phone || null, role: c.role || null,
      isPrimary: c.isPrimary || (i === 0 && !all.some((x) => x.isPrimary)),
    }));
    const data = {
      name: d.name, street: d.street || null, zip: d.zip || null, city: d.city || null, website: d.website || null,
      notes: d.notes || null, ownerId: d.ownerId || null,
    };
    let id = d.id;
    if (id) {
      await ownSponsor(tenantId, id);
      await prisma.$transaction([
        prisma.sponsor.update({ where: { id }, data }),
        prisma.sponsorContact.deleteMany({ where: { sponsorId: id } }),
        prisma.sponsorContact.createMany({ data: contacts.map((c) => ({ ...c, sponsorId: id! })) }),
      ]);
    } else {
      const s = await prisma.sponsor.create({ data: { ...data, tenantId, token: newSponsorToken(), contacts: { create: contacts } } });
      id = s.id;
      await logSponsor(tenantId, id, actorId, "Sponsor erfasst");
    }
    refresh(slug);
    return { success: true, id };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function deleteSponsorAction(slug: string, sponsorId: string): Promise<Res> {
  try {
    const { tenantId } = await admin(slug);
    await ownSponsor(tenantId, sponsorId);
    if (await prisma.sponsorInvoice.count({ where: { sponsorId } })) throw new Error("Hat Rechnungen und bleibt für die Buchhaltung erhalten.");
    await prisma.sponsor.delete({ where: { id: sponsorId } });
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

/** New portal link (old one stops working), e.g. after a contact person left. */
export async function renewPortalLinkAction(slug: string, sponsorId: string): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    await ownSponsor(tenantId, sponsorId);
    await prisma.sponsor.update({ where: { id: sponsorId }, data: { token: newSponsorToken() } });
    await logSponsor(tenantId, sponsorId, actorId, "Neuer persönlicher Link erstellt");
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Katalog ----------

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_UPLOAD = 3 * 1024 * 1024;

async function readUpload(file: FormDataEntryValue | null, types: string[]) {
  if (!(file instanceof File) || !file.size) return null;
  if (file.size > MAX_UPLOAD) throw new Error("Datei grösser als 3 MB.");
  if (!types.includes(file.type)) throw new Error("Dateityp nicht unterstützt.");
  return { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type };
}

export async function saveItemAction(slug: string, form: FormData): Promise<Res> {
  try {
    const { tenantId } = await admin(slug);
    const id = String(form.get("id") ?? "");
    const name = String(form.get("name") ?? "").trim().slice(0, 120);
    const price = Number(String(form.get("price") ?? "").replace(/[’'\s]/g, ""));
    const capRaw = String(form.get("capacity") ?? "").trim();
    const capacity = capRaw ? Math.trunc(Number(capRaw)) : null;
    if (!name) throw new Error("Name fehlt.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Preis ungültig.");
    if (capacity != null && (!Number.isFinite(capacity) || capacity < 1)) throw new Error("Anzahl Plätze: leer (unbegrenzt) oder mindestens 1.");
    const img = await readUpload(form.get("image"), IMAGE_TYPES);
    const data = {
      name, price, capacity,
      description: String(form.get("description") ?? "").trim().slice(0, 500) || null,
      badge: String(form.get("badge") ?? "").trim().slice(0, 30) || null,
      deliverables: String(form.get("deliverables") ?? "").split("\n").map((s) => s.trim().slice(0, 120)).filter(Boolean).slice(0, 10),
      sortOrder: Math.trunc(Number(form.get("sortOrder") ?? 0)) || 0,
      active: form.get("active") !== "false",
      ...(img ? { image: img.bytes, imageType: img.type } : {}),
      ...(form.get("removeImage") === "true" ? { image: null, imageType: null } : {}),
    };
    if (id) {
      if (!(await prisma.sponsorItem.findFirst({ where: { id, tenantId } }))) throw new Error("Leistung nicht gefunden.");
      await prisma.sponsorItem.update({ where: { id }, data });
    } else {
      await prisma.sponsorItem.create({ data: { ...data, tenantId } });
    }
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

/** Deletes an unused item; one that is part of a contract is only hidden from the portal. */
export async function deleteItemAction(slug: string, itemId: string): Promise<Res<{ hidden: boolean }>> {
  try {
    const { tenantId } = await admin(slug);
    if (!(await prisma.sponsorItem.findFirst({ where: { id: itemId, tenantId } }))) throw new Error("Leistung nicht gefunden.");
    const used = await prisma.sponsorContractLine.count({ where: { itemId } });
    if (used) await prisma.sponsorItem.update({ where: { id: itemId }, data: { active: false } });
    else await prisma.sponsorItem.delete({ where: { id: itemId } });
    refresh(slug);
    return { success: true, hidden: used > 0 };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Verträge, Status, Rechnungen, Gegenleistungen, Aufgaben ----------

const linesSchema = z.array(z.object({ itemId: z.string(), quantity: z.number().int().min(0).max(50) })).max(30);

export async function createContractAction(slug: string, sponsorId: string, startYear: number, years: number, lines: z.input<typeof linesSchema>): Promise<Res<{ notSent?: string | null }>> {
  try {
    const { tenantId, actorId } = await admin(slug);
    await ownSponsor(tenantId, sponsorId);
    if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) throw new Error("Jahr ungültig.");
    const b = await buyItems({ tenantId, sponsorId, year: startYear, years, lines: linesSchema.parse(lines), source: "admin", actorId });
    const inv = await confirmPurchase({ tenantId, sponsorId, contractId: b.contract.id, year: startYear, lineIds: b.lineIds, actorId, source: "admin" });
    refresh(slug);
    return { success: true, notSent: inv?.notSent };
  } catch (e) {
    return fail(e);
  }
}

/** Ends a contract before fromYear (fromYear = startYear removes it completely); invoices already issued stay. */
export async function endContractAction(slug: string, contractId: string, fromYear: number): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const c = await prisma.sponsorContract.findFirst({ where: { id: contractId, sponsor: { tenantId } } });
    if (!c) throw new Error("Vertrag nicht gefunden.");
    const keep = Math.max(0, Math.min(c.years, fromYear - c.startYear));
    if (await prisma.sponsorInvoice.count({ where: { contractId, year: { gte: c.startYear + keep } } })) {
      throw new Error(`Für ${fromYear} oder später gibt es schon eine Rechnung. Bitte zuerst mit der Buchhaltung klären.`);
    }
    await prisma.sponsorContract.update({ where: { id: contractId }, data: keep ? { years: keep } : { cancelledAt: new Date() } });
    await prisma.sponsorDeliverable.deleteMany({ where: { sponsorId: c.sponsorId, year: { gte: c.startYear + keep }, doneAt: null } });
    await logSponsor(tenantId, c.sponsorId, actorId, keep ? `Vertrag endet nach ${c.startYear + keep - 1}` : `Vertrag ${c.startYear} storniert`);
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

/** Manual status (answer by phone): declined, or back to requested. "Zugesagt" goes through a contract. */
export async function setRequestStatusAction(slug: string, sponsorId: string, year: number, status: "DECLINED" | "REQUESTED"): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    await ownSponsor(tenantId, sponsorId);
    await prisma.sponsorRequest.upsert({
      where: { sponsorId_year: { sponsorId, year } },
      create: { sponsorId, year, status, respondedAt: status === "DECLINED" ? new Date() : null },
      update: { status, respondedAt: status === "DECLINED" ? new Date() : null },
    });
    await logSponsor(tenantId, sponsorId, actorId, status === "DECLINED" ? `Absage ${year} erfasst` : `${year} wieder auf «angefragt» gesetzt`);
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function markInvoicePaidAction(slug: string, invoiceId: string, paid: boolean): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const inv = await prisma.sponsorInvoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!inv) throw new Error("Rechnung nicht gefunden.");
    await prisma.sponsorInvoice.update({ where: { id: invoiceId }, data: { paidAt: paid ? new Date() : null } });
    await logSponsor(tenantId, inv.sponsorId, actorId, `Rechnung Nr. ${inv.number} ${paid ? `bezahlt (${chf(Number(inv.amount))})` : "wieder offen"}`);
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resendInvoiceAction(slug: string, invoiceId: string): Promise<Res> {
  try {
    const { tenantId } = await admin(slug);
    if (!(await prisma.sponsorInvoice.findFirst({ where: { id: invoiceId, tenantId } }))) throw new Error("Rechnung nicht gefunden.");
    const why = await sendInvoiceMailWhy(invoiceId);
    if (why) throw new Error(`Nicht verschickt: ${why}.`);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleDeliverableAction(slug: string, id: string, done: boolean): Promise<Res> {
  try {
    const { tenantId } = await admin(slug);
    const d = await prisma.sponsorDeliverable.findFirst({ where: { id, sponsor: { tenantId } } });
    if (!d) throw new Error("Eintrag nicht gefunden.");
    await prisma.sponsorDeliverable.update({ where: { id }, data: { doneAt: done ? new Date() : null } });
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addDeliverableAction(slug: string, sponsorId: string, year: number, label: string): Promise<Res> {
  try {
    const { tenantId } = await admin(slug);
    await ownSponsor(tenantId, sponsorId);
    const l = label.trim().slice(0, 120);
    if (!l) throw new Error("Text fehlt.");
    await prisma.sponsorDeliverable.createMany({ data: [{ sponsorId, year, label: l }], skipDuplicates: true });
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function completeTaskAction(slug: string, taskId: string): Promise<Res> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const t = await prisma.sponsorTask.findFirst({ where: { id: taskId, sponsor: { tenantId } } });
    if (!t) throw new Error("Aufgabe nicht gefunden.");
    await prisma.sponsorTask.update({ where: { id: taskId }, data: { doneAt: new Date() } });
    await logSponsor(tenantId, t.sponsorId, actorId, `Aufgabe erledigt: ${t.title}`);
    refresh(slug);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Kampagne & Import ----------

export async function startCampaignAction(slug: string, year: number, reminderDays: number, taskDays: number): Promise<Res<{ summary: string }>> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const now = new Date().getFullYear();
    if (!Number.isInteger(year) || year < now || year > now + 1) throw new Error(`Kampagne nur für ${now} oder ${now + 1}.`);
    if (!(reminderDays >= 3 && reminderDays <= 60 && taskDays > reminderDays && taskDays <= 120)) throw new Error("Fristen prüfen: Erinnerung 3–60 Tage, Aufgabe danach.");
    const r = await startCampaign({ tenantId, year, reminderDays, taskDays, actorId });
    refresh(slug);
    return { success: true, summary: `${r.requested} angefragt (${r.sent} Mails verschickt), ${r.running} laufende Verträge verrechnet` };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Excel/CSV import. Updates sponsors with the same company name, adds new contacts by e-mail.
 * Items that match the catalog become a confirmed 1-year contract for the list's year (no invoice:
 * that year was billed by hand), so the portal shows "Ihre Wahl <Jahr>" next time.
 */
export async function importSponsorsAction(slug: string, text: string, defaultYear: number): Promise<Res<{ created: number; updated: number; contracts: number; unmatched: string[] }>> {
  try {
    const { tenantId, actorId } = await admin(slug);
    const { rows } = parseSponsors(text);
    if (!rows.length) throw new Error("Keine gültigen Zeilen.");
    if (rows.length > 1000) throw new Error("Maximal 1000 Zeilen pro Import.");
    const [existing, items, board] = await Promise.all([
      prisma.sponsor.findMany({ where: { tenantId }, include: { contacts: true, contracts: true } }),
      prisma.sponsorItem.findMany({ where: { tenantId } }),
      prisma.tenantUser.findMany({ where: { tenantId, role: { in: ["CLUB_ADMIN", "COURT_MANAGER", "COACH"] } }, include: { user: true } }),
    ]);
    const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, "");
    const findItem = (n: string) => items.find((i) => norm(i.name) === norm(n)) ?? items.find((i) => norm(i.name).includes(norm(n)) || norm(n).includes(norm(i.name)));
    const findOwner = (o?: string) => o ? board.find((b) => b.user.email.toLowerCase() === o.toLowerCase() || norm(`${b.user.firstName}${b.user.lastName}`) === norm(o) || norm(`${b.user.lastName}${b.user.firstName}`) === norm(o))?.userId : undefined;
    let created = 0, updated = 0, contracts = 0;
    const unmatched = new Set<string>();

    for (const r of rows) {
      const year = r.year ?? defaultYear;
      const ownerId = findOwner(r.owner);
      const prev = byName.get(r.name.toLowerCase());
      const matched = (r.items ?? []).map((n) => ({ n, it: findItem(n) }));
      matched.filter((m) => !m.it).forEach((m) => unmatched.add(m.n));
      const lines = matched.filter((m) => m.it).map((m) => m.it!);
      const note = !lines.length && (r.amount || r.items?.length) ? `Excel ${year}: ${r.items?.join(", ") ?? ""}${r.amount ? ` ${chf(r.amount)}` : ""}`.trim() : "";
      const notes = [r.notes, note].filter(Boolean).join("\n") || undefined;
      const fields = {
        ...(r.street ? { street: r.street } : {}), ...(r.zip ? { zip: r.zip } : {}), ...(r.city ? { city: r.city } : {}),
        ...(r.website ? { website: r.website } : {}), ...(ownerId ? { ownerId } : {}),
      };
      let sponsorId: string;
      let hasContract = false;
      if (prev) {
        sponsorId = prev.id;
        hasContract = prev.contracts.some((c) => coversYear(c, year));
        const known = prev.contacts.some((c) => (r.email && c.email === r.email) || (!r.email && r.contact && c.name === r.contact));
        await prisma.sponsor.update({
          where: { id: sponsorId },
          data: {
            ...fields,
            ...(notes && !prev.notes?.includes(notes) ? { notes: [prev.notes, notes].filter(Boolean).join("\n") } : {}),
            ...(!known && (r.contact || r.email) ? { contacts: { create: { name: r.contact ?? r.email!, email: r.email ?? null, phone: r.phone ?? null, isPrimary: !prev.contacts.length } } } : {}),
          },
        });
        updated++;
      } else {
        const s = await prisma.sponsor.create({
          data: {
            tenantId, name: r.name, token: newSponsorToken(), ...fields, notes: notes ?? null,
            ...(r.contact || r.email ? { contacts: { create: { name: r.contact ?? r.email!, email: r.email ?? null, phone: r.phone ?? null, isPrimary: true } } } : {}),
          },
        });
        sponsorId = s.id;
        byName.set(r.name.toLowerCase(), { ...s, contacts: [], contracts: [] });
        await logSponsor(tenantId, sponsorId, actorId, "Aus Excel-Liste importiert");
        created++;
      }
      if (lines.length && !hasContract) {
        // a single item with an amount keeps the price actually paid that year
        const single = lines.length === 1 && r.amount != null;
        await prisma.sponsorContract.create({
          data: {
            sponsorId, startYear: year, years: 1, discountPct: 0, source: "import",
            lines: { create: lines.map((it) => ({ itemId: it.id, quantity: 1, unitPrice: single ? r.amount! : it.price })) },
          },
        });
        await prisma.sponsorRequest.upsert({
          where: { sponsorId_year: { sponsorId, year } },
          create: { sponsorId, year, status: "CONFIRMED", respondedAt: new Date() },
          update: {},
        });
        await logSponsor(tenantId, sponsorId, actorId, `${year}: ${lines.map((l) => l.name).join(", ")} (aus Excel)`);
        contracts++;
      }
    }
    refresh(slug);
    return { success: true, created, updated, contracts, unmatched: [...unmatched] };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Sponsorenportal (persönlicher Link, ohne Login) ----------

async function bySponsorToken(token: string) {
  const s = typeof token === "string" && token.length >= 20 ? await prisma.sponsor.findUnique({ where: { token }, include: { tenant: true, owner: true } }) : null;
  if (!s) throw new Error("Link ungültig. Bitte wenden Sie sich an den Club.");
  return s;
}
const refreshPortal = (token: string) => revalidatePath(`/sponsor/${token}`);

/**
 * Sponsor buys in the portal: a new contract, or more items added to the running one (until its end, with its
 * discount, full yearly price). pay "invoice" = final now, QR invoice by mail. pay "stripe" = places held for
 * the checkout, confirmed by the webhook after payment (owner 2026-10-07).
 */
export async function portalBuyAction(token: string, lines: z.input<typeof linesSchema>, years: number, pay: "invoice" | "stripe"): Promise<Res<{ url?: string }>> {
  try {
    const s = await bySponsorToken(token);
    const year = await currentSponsorYear(s.tenantId);
    const online = pay === "stripe";
    if (online && !process.env.STRIPE_SECRET_KEY) throw new Error("Online-Zahlung ist nicht eingerichtet. Bitte «Auf Rechnung» wählen.");
    if (process.env.STRIPE_SECRET_KEY) await settleOwnCheckouts(s.id); // e.g. came back from Stripe with the browser's back button
    const b = await buyItems({ tenantId: s.tenantId, sponsorId: s.id, year, years, lines: linesSchema.parse(lines), source: "portal", actorId: null, hold: online });
    if (!online) {
      await confirmPurchase({ tenantId: s.tenantId, sponsorId: s.id, contractId: b.contract.id, year, lineIds: b.lineIds, actorId: null, source: "portal" });
      if (s.owner?.email) {
        await sendMail(s.owner.email, `${b.addOn ? "Zusatzkauf" : "Zusage"} Sponsoring ${year}: ${s.name}`, `${s.name} hat online ${b.addOn ? "dazugekauft" : "zugesagt"}: ${b.what} (${chf(b.amount)}/Jahr). Die Rechnung ist verschickt.`);
      }
      refreshPortal(token);
      return { success: true };
    }
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const end = b.contract.startYear + b.contract.years - 1;
    try {
      const contact = await prisma.sponsorContact.findFirst({ where: { sponsorId: s.id, email: { not: null } }, orderBy: { isPrimary: "desc" } });
      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        ...(contact?.email ? { customer_email: contact.email } : {}),
        line_items: [{
          price_data: {
            currency: "chf",
            product_data: { name: `Sponsoring ${year} · ${s.tenant.name}`, description: `${b.what}${end > year ? ` · Vertrag bis ${end}, Betrag für ${year}` : ""}`.slice(0, 500) },
            unit_amount: Math.round(b.amount * 100),
          },
          quantity: 1,
        }],
        metadata: { purpose: "sponsoring", sponsorId: s.id, contractId: b.contract.id },
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
        success_url: `${base}/sponsor/${token}?bezahlt=1`,
        cancel_url: `${base}/sponsor/${token}?abbruch={CHECKOUT_SESSION_ID}`,
      });
      await prisma.sponsorContractLine.updateMany({ where: { id: { in: b.lineIds } }, data: { stripeSessionId: session.id } });
      return { success: true, url: session.url ?? undefined };
    } catch (e) {
      // no checkout → don't keep the places blocked
      await prisma.sponsorContractLine.deleteMany({ where: { id: { in: b.lineIds } } });
      await prisma.sponsorContract.deleteMany({ where: { id: b.contract.id, lines: { none: {} } } });
      console.error("Sponsoring-Checkout:", e);
      throw new Error("Online-Zahlung konnte nicht gestartet werden. Bitte nochmals versuchen oder «Auf Rechnung» wählen.");
    }
  } catch (e) {
    return fail(e);
  }
}

/** Back from Stripe with "Abbrechen": end the session and free the held places at once. */
export async function portalCancelCheckoutAction(token: string, sessionId: string): Promise<Res> {
  try {
    const s = await bySponsorToken(token);
    const own = await prisma.sponsorContractLine.count({ where: { stripeSessionId: sessionId, pendingUntil: { not: null }, contract: { sponsorId: s.id } } });
    if (own) await settleOwnCheckouts(s.id);
    refreshPortal(token);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function portalDeclineAction(token: string): Promise<Res> {
  try {
    const s = await bySponsorToken(token);
    const year = await currentSponsorYear(s.tenantId);
    const req = await prisma.sponsorRequest.findUnique({ where: { sponsorId_year: { sponsorId: s.id, year } } });
    if (req?.status === "CONFIRMED") throw new Error("Bereits zugesagt. Für Änderungen bitte den Club kontaktieren.");
    await prisma.sponsorRequest.upsert({
      where: { sponsorId_year: { sponsorId: s.id, year } },
      create: { sponsorId: s.id, year, status: "DECLINED", respondedAt: new Date() },
      update: { status: "DECLINED", respondedAt: new Date() },
    });
    await prisma.sponsorTask.updateMany({ where: { sponsorId: s.id, doneAt: null, title: NO_ANSWER(year) }, data: { doneAt: new Date() } });
    await logSponsor(s.tenantId, s.id, null, `Absage ${year} online`);
    if (s.owner?.email) {
      await sendMail(s.owner.email, `Absage Sponsoring ${year}: ${s.name}`, `${s.name} macht ${year} nicht mit (online abgesagt).`);
    }
    refreshPortal(token);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function portalLogoAction(token: string, form: FormData): Promise<Res> {
  try {
    const s = await bySponsorToken(token);
    const f = await readUpload(form.get("logo"), [...IMAGE_TYPES, "application/pdf"]);
    if (!f) throw new Error("Bitte eine Datei wählen.");
    await prisma.sponsor.update({ where: { id: s.id }, data: { logo: f.bytes, logoType: f.type, logoConfirmedAt: null } });
    await logSponsor(s.tenantId, s.id, null, "Logo hochgeladen");
    refreshPortal(token);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function portalConfirmLogoAction(token: string): Promise<Res> {
  try {
    const s = await bySponsorToken(token);
    if (!s.logoType) throw new Error("Noch kein Logo hochgeladen.");
    await prisma.sponsor.update({ where: { id: s.id }, data: { logoConfirmedAt: new Date() } });
    await logSponsor(s.tenantId, s.id, null, "Logo online bestätigt");
    refreshPortal(token);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

/** Admin: bill a contract year by hand (e.g. a running contract before the campaign). */
export async function billYearAction(slug: string, contractId: string, year: number): Promise<Res<{ warning?: string }>> {
  try {
    const { tenantId } = await admin(slug);
    if (!(await prisma.sponsorContract.findFirst({ where: { id: contractId, sponsor: { tenantId } } }))) throw new Error("Vertrag nicht gefunden.");
    const inv = await billYear(contractId, year);
    if (!inv) throw new Error(`Vertrag deckt ${year} nicht ab.`);
    refresh(slug);
    return { success: true, ...(inv.notSent && { warning: `Rechnung ${year} erstellt, aber nicht verschickt: ${inv.notSent}.` }) };
  } catch (e) {
    return fail(e);
  }
}
