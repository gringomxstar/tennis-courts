import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { DISCOUNT, PAYMENT_DAYS, DAY, campaignStep, chf, coversYear, dunningStep, yearlyAmount } from "@/lib/sponsoring";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const portalUrl = (token: string) => `${appUrl()}/sponsor/${token}`;
export const invoiceUrl = (token: string, invoiceId: string) => `${appUrl()}/sponsor/${token}/rechnung/${invoiceId}`;
export const newSponsorToken = () => randomBytes(18).toString("base64url");

/** One line in the sponsor's history (card timeline). Never throws. */
export async function logSponsor(tenantId: string, sponsorId: string, actorId: string | null, text: string) {
  await prisma.auditLog
    .create({ data: { tenantId, actorId, action: "SPONSOR", entityType: "Sponsor", entityId: sponsorId, metadataJson: { text } } })
    .catch((e) => console.error("Audit-Log fehlgeschlagen:", e));
}

type WithContacts = { contacts: { name: string; email: string | null; isPrimary: boolean }[] };
export const mainContact = (s: WithContacts) => s.contacts.find((c) => c.isPrimary && c.email) ?? s.contacts.find((c) => c.email) ?? null;
const hello = (s: WithContacts) => {
  const c = mainContact(s);
  return c?.name ? `Guten Tag ${c.name}` : "Guten Tag";
};

/** Places taken per item in a year (all sponsors, cancelled contracts excluded). */
export async function takenByItem(tenantId: string, year: number, db: Prisma.TransactionClient = prisma) {
  const lines = await db.sponsorContractLine.findMany({
    where: { contract: { sponsor: { tenantId }, cancelledAt: null, startYear: { lte: year, gt: year - 3 } } },
    select: { itemId: true, quantity: true, contract: { select: { startYear: true, years: true } } },
  });
  const taken = new Map<string, number>();
  for (const l of lines) if (coversYear(l.contract, year)) taken.set(l.itemId, (taken.get(l.itemId) ?? 0) + l.quantity);
  return taken;
}

/**
 * Signs a contract (portal or admin): checks free places for every year of the term under a per-club lock,
 * fixes catalog prices and the duration discount, marks the year's request as confirmed and bills the first year.
 */
export async function createContract(o: {
  tenantId: string; sponsorId: string; startYear: number; years: number;
  lines: { itemId: string; quantity: number }[]; source: "portal" | "admin" | "import"; actorId: string | null;
}) {
  if (![1, 2, 3].includes(o.years)) throw new Error("Laufzeit 1, 2 oder 3 Jahre.");
  const lines = o.lines.filter((l) => l.quantity > 0);
  if (!lines.length) throw new Error("Bitte mindestens eine Leistung wählen.");
  const contract = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sponsor:" + o.tenantId}))`;
    const sponsor = await tx.sponsor.findFirst({ where: { id: o.sponsorId, tenantId: o.tenantId }, include: { contracts: true } });
    if (!sponsor) throw new Error("Sponsor nicht gefunden.");
    const items = await tx.sponsorItem.findMany({ where: { tenantId: o.tenantId, id: { in: lines.map((l) => l.itemId) }, active: true } });
    if (items.length !== new Set(lines.map((l) => l.itemId)).size) throw new Error("Eine Leistung ist nicht mehr im Katalog.");
    for (let y = o.startYear; y < o.startYear + o.years; y++) {
      if (sponsor.contracts.some((c) => coversYear(c, y))) throw new Error(`Für ${y} besteht bereits ein Vertrag.`);
      const taken = await takenByItem(o.tenantId, y, tx);
      for (const l of lines) {
        const it = items.find((i) => i.id === l.itemId)!;
        if (it.capacity != null && (taken.get(it.id) ?? 0) + l.quantity > it.capacity) throw new Error(`«${it.name}» ist ${y} bereits vergeben.`);
      }
    }
    const c = await tx.sponsorContract.create({
      data: {
        sponsorId: o.sponsorId, startYear: o.startYear, years: o.years, discountPct: DISCOUNT[o.years], source: o.source,
        lines: { create: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: items.find((i) => i.id === l.itemId)!.price })) },
      },
      include: { lines: { include: { item: true } } },
    });
    await tx.sponsorRequest.upsert({
      where: { sponsorId_year: { sponsorId: o.sponsorId, year: o.startYear } },
      create: { sponsorId: o.sponsorId, year: o.startYear, status: "CONFIRMED", respondedAt: new Date() },
      update: { status: "CONFIRMED", respondedAt: new Date() },
    });
    // the sponsor answered: the "no answer" task is obsolete
    await tx.sponsorTask.updateMany({ where: { sponsorId: o.sponsorId, doneAt: null, title: NO_ANSWER(o.startYear) }, data: { doneAt: new Date() } });
    return c;
  });
  const amount = yearlyAmount(contract.lines.map((l) => ({ quantity: l.quantity, unitPrice: Number(l.unitPrice) })), contract.discountPct);
  const what = contract.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ""}${l.item.name}`).join(", ");
  await logSponsor(o.tenantId, o.sponsorId, o.actorId, `Vertrag ${o.startYear}${o.years > 1 ? `–${o.startYear + o.years - 1}` : ""}: ${what}, ${chf(amount)}/Jahr${contract.discountPct ? ` (−${contract.discountPct} %)` : ""}${o.source === "portal" ? " · online bestätigt" : ""}`);
  await billYear(contract.id, o.startYear);
  return contract;
}

/** Invoice + deliverables checklist for one contract year; idempotent. Sends the invoice mail right away. */
export async function billYear(contractId: string, year: number) {
  const c = await prisma.sponsorContract.findUnique({ where: { id: contractId }, include: { lines: { include: { item: true } }, sponsor: true } });
  if (!c || !coversYear(c, year)) return null;
  const labels = [...new Set(c.lines.flatMap((l) => l.item.deliverables))];
  if (labels.length) {
    await prisma.sponsorDeliverable.createMany({ data: labels.map((label) => ({ sponsorId: c.sponsorId, year, label })), skipDuplicates: true });
  }
  const existing = await prisma.sponsorInvoice.findUnique({ where: { contractId_year: { contractId, year } } });
  if (existing) return existing;
  const amount = yearlyAmount(c.lines.map((l) => ({ quantity: l.quantity, unitPrice: Number(l.unitPrice) })), c.discountPct);
  const inv = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sponsor-inv:" + c.sponsor.tenantId}))`;
    const again = await tx.sponsorInvoice.findUnique({ where: { contractId_year: { contractId, year } } });
    if (again) return null;
    const last = await tx.sponsorInvoice.aggregate({ where: { tenantId: c.sponsor.tenantId }, _max: { number: true } });
    const now = new Date();
    return tx.sponsorInvoice.create({
      data: {
        tenantId: c.sponsor.tenantId, sponsorId: c.sponsorId, contractId, year, amount,
        number: (last._max.number ?? 1000) + 1, issuedAt: now, dueAt: new Date(now.getTime() + PAYMENT_DAYS * DAY),
      },
    });
  });
  if (!inv) return prisma.sponsorInvoice.findUnique({ where: { contractId_year: { contractId, year } } });
  await logSponsor(c.sponsor.tenantId, c.sponsorId, null, `Rechnung Nr. ${inv.number} (${year}) über ${chf(amount)} erstellt`);
  await sendInvoiceMail(inv.id);
  return inv;
}

async function loadInvoice(invoiceId: string) {
  return prisma.sponsorInvoice.findUnique({
    where: { id: invoiceId },
    include: { sponsor: { include: { contacts: true, tenant: true } }, contract: true },
  });
}

/** Invoice mail (first time) or dunning mail (level 1/2). Marks sentAt on success. */
export async function sendInvoiceMail(invoiceId: string, dunning?: 1 | 2) {
  const inv = await loadInvoice(invoiceId);
  const to = inv && mainContact(inv.sponsor)?.email;
  if (!inv || !to) return false;
  const s = inv.sponsor;
  const club = s.tenant.name;
  const due = inv.dueAt.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
  const running = inv.contract.years > 1 && inv.year > inv.contract.startYear;
  const subject = dunning === 2 ? `2. Mahnung: Rechnung Nr. ${inv.number}, ${club}` : dunning ? `Zahlungserinnerung: Rechnung Nr. ${inv.number}, ${club}` : `Rechnung Sponsoring ${inv.year}: ${club}`;
  const body = dunning
    ? [`für das Sponsoring ${inv.year} ist die Rechnung Nr. ${inv.number} über ${chf(Number(inv.amount))} (fällig am ${due}) noch offen.`, "Falls Sie bereits bezahlt haben, betrachten Sie diese Mail als gegenstandslos."]
    : [
        running
          ? `Ihr Sponsoring-Vertrag läuft bis ${inv.contract.startYear + inv.contract.years - 1}. Danke, dass Sie ${inv.year} wieder dabei sind.`
          : `herzlichen Dank für Ihr Sponsoring ${inv.year}.`,
        `Ihre Rechnung Nr. ${inv.number} über ${chf(Number(inv.amount))}, zahlbar bis ${due}:`,
      ];
  const ok = await sendMail(to, subject, [
    hello(s), "", ...body,
    `Rechnung mit QR-Einzahlungsschein: ${invoiceUrl(s.token, inv.id)}`,
    "", `Logo und Auswahl: ${portalUrl(s.token)}`, "", `Freundliche Grüsse`, club,
  ].join("\n"));
  if (ok && !dunning) await prisma.sponsorInvoice.update({ where: { id: inv.id }, data: { sentAt: new Date() } });
  return ok;
}

async function sendRequestMail(sponsorId: string, year: number, reminder: boolean) {
  const s = await prisma.sponsor.findUnique({ where: { id: sponsorId }, include: { contacts: true, tenant: true, contracts: true } });
  const to = s && mainContact(s)?.email;
  if (!s || !to) return false;
  const prev = s.contracts.some((c) => coversYear(c, year - 1));
  return sendMail(to, `${reminder ? "Erinnerung: " : ""}Sponsoring ${year} beim ${s.tenant.name}`, [
    hello(s), "",
    prev ? `herzlichen Dank für Ihre Unterstützung ${year - 1}. Dürfen wir auch ${year} auf Sie zählen?` : `dürfen wir ${year} auf Ihre Unterstützung zählen?`,
    "",
    prev ? `Unter Ihrem persönlichen Link sehen Sie Ihre Wahl ${year - 1} und verlängern mit einem Klick. Sie können auch andere Leistungen wählen oder 2 bzw. 3 Jahre abschliessen (−10 % bzw. −15 %):`
      : "Unter Ihrem persönlichen Link finden Sie alle Leistungen mit Preisen und können direkt online zusagen:",
    portalUrl(s.token),
    "", reminder ? "Falls Sie dieses Jahr nicht mitmachen möchten, können Sie dort auch absagen. Dann erinnern wir Sie nicht mehr." : "Kein Login nötig.",
    "", "Freundliche Grüsse", s.tenant.name,
  ].join("\n"));
}

/** Task for the responsible board member (once per title) + mail to them. */
export async function createTask(sponsorId: string, title: string) {
  const s = await prisma.sponsor.findUnique({ where: { id: sponsorId }, include: { owner: true, tenant: true } });
  if (!s) return;
  if (await prisma.sponsorTask.findFirst({ where: { sponsorId, title } })) return;
  await prisma.sponsorTask.create({ data: { sponsorId, title, assigneeId: s.ownerId } });
  await logSponsor(s.tenantId, sponsorId, null, `Aufgabe für ${s.owner ? `${s.owner.firstName} ${s.owner.lastName}` : "Vorstand"}: ${title}`);
  if (s.owner?.email) {
    await sendMail(s.owner.email, `Aufgabe Sponsoring: ${s.name}`, [
      `Hallo ${s.owner.firstName}`, "", `${s.name}: ${title}`, "",
      `Sponsorenkarte: ${appUrl()}/c/${s.tenant.slug}/admin/sponsoring/${s.id}`,
    ].join("\n"));
  }
}

export const NO_ANSWER = (year: number) => `Sponsoring ${year}: keine Antwort, bitte persönlich nachfragen`;
export const NO_EMAIL = (year: number) => `Sponsoring ${year}: keine E-Mail-Adresse, bitte persönlich anfragen`;

/**
 * Starts the yearly campaign: sponsors with a running contract are confirmed and billed without a request,
 * all others get a request (mailed by runSponsoring, which is called right away and then daily by the cron).
 */
export async function startCampaign(o: { tenantId: string; year: number; reminderDays: number; taskDays: number; actorId: string | null }) {
  await prisma.sponsorCampaign.upsert({
    where: { tenantId_year: { tenantId: o.tenantId, year: o.year } },
    create: { tenantId: o.tenantId, year: o.year, reminderDays: o.reminderDays, taskDays: o.taskDays },
    update: { reminderDays: o.reminderDays, taskDays: o.taskDays },
  });
  const sponsors = await prisma.sponsor.findMany({ where: { tenantId: o.tenantId }, include: { contracts: true, requests: { where: { year: o.year } } } });
  let running = 0, requested = 0;
  for (const s of sponsors) {
    const c = s.contracts.find((x) => coversYear(x, o.year));
    if (c) {
      running++;
      if (s.requests[0]?.status !== "CONFIRMED") {
        await prisma.sponsorRequest.upsert({
          where: { sponsorId_year: { sponsorId: s.id, year: o.year } },
          create: { sponsorId: s.id, year: o.year, status: "CONFIRMED", respondedAt: new Date() },
          update: { status: "CONFIRMED", respondedAt: new Date() },
        });
        await logSponsor(o.tenantId, s.id, null, `Sponsoring ${o.year}: Vertrag läuft weiter, keine Anfrage nötig`);
      }
      await billYear(c.id, o.year);
    } else if (!s.requests.length) {
      requested++;
      await prisma.sponsorRequest.create({ data: { sponsorId: s.id, year: o.year } });
    }
  }
  await logSponsor(o.tenantId, o.tenantId, o.actorId, `Kampagne ${o.year} gestartet: ${requested} Anfragen, ${running} laufende Verträge`);
  const run = await runSponsoring(new Date(), o.tenantId);
  return { running, requested, ...run };
}

/** Daily run (cron + campaign start): first mails, reminders, tasks, invoices of running contracts, dunning. */
export async function runSponsoring(now = new Date(), tenantId?: string) {
  let budget = 250; // Brevo free plan: 300 mails/day, leave room for booking mails
  const stats = { sent: 0, reminded: 0, tasks: 0, billed: 0, dunned: 0 };
  const thisYear = now.getFullYear();

  const campaigns = await prisma.sponsorCampaign.findMany({ where: { year: { gte: thisYear }, ...(tenantId ? { tenantId } : {}) } });
  for (const camp of campaigns) {
    const reqs = await prisma.sponsorRequest.findMany({
      where: { year: camp.year, status: { in: ["REQUESTED", "REMINDED"] }, sponsor: { tenantId: camp.tenantId } },
      include: { sponsor: { include: { contacts: true, tasks: { where: { title: NO_ANSWER(camp.year) } } } } },
    });
    for (const r of reqs) {
      const step = campaignStep(r, camp, now, r.sponsor.tasks.length > 0);
      if (!step) continue;
      if (step === "task") {
        await createTask(r.sponsorId, NO_ANSWER(camp.year));
        stats.tasks++;
        continue;
      }
      if (!mainContact(r.sponsor)) {
        await createTask(r.sponsorId, NO_EMAIL(camp.year));
        continue;
      }
      if (budget <= 0) break;
      budget--;
      if (!(await sendRequestMail(r.sponsorId, camp.year, step === "remind"))) continue;
      if (step === "send") {
        await prisma.sponsorRequest.update({ where: { id: r.id }, data: { sentAt: now } });
        await logSponsor(camp.tenantId, r.sponsorId, null, `Anfrage ${camp.year} per E-Mail verschickt`);
        stats.sent++;
      } else {
        await prisma.sponsorRequest.update({ where: { id: r.id }, data: { status: "REMINDED", remindedAt: now, reminders: { increment: 1 } } });
        await logSponsor(camp.tenantId, r.sponsorId, null, `Erinnerung ${r.reminders + 1} für ${camp.year} verschickt`);
        stats.reminded++;
      }
    }
  }

  // running multi-year contracts: bill the current year from 1 January even without a campaign
  const contracts = await prisma.sponsorContract.findMany({
    where: { cancelledAt: null, startYear: { lte: thisYear, gt: thisYear - 3 }, invoices: { none: { year: thisYear } }, ...(tenantId ? { sponsor: { tenantId } } : {}) },
  });
  for (const c of contracts) {
    if (!coversYear(c, thisYear) || budget <= 0) continue;
    budget--;
    await billYear(c.id, thisYear);
    stats.billed++;
  }

  const open = await prisma.sponsorInvoice.findMany({ where: { paidAt: null, ...(tenantId ? { tenantId } : {}) } });
  for (const inv of open) {
    if (budget <= 0) break;
    if (!inv.sentAt) {
      budget--;
      await sendInvoiceMail(inv.id);
      continue;
    }
    const step = dunningStep(inv, now);
    if (!step) continue;
    if (step === 3) {
      await createTask(inv.sponsorId, `Rechnung Nr. ${inv.number}: nach 2 Mahnungen unbezahlt, bitte nachfragen`);
    } else {
      budget--;
      if (!(await sendInvoiceMail(inv.id, step))) continue;
      await logSponsor(inv.tenantId, inv.sponsorId, null, `${step === 1 ? "Zahlungserinnerung" : "2. Mahnung"} für Rechnung Nr. ${inv.number} verschickt`);
    }
    await prisma.sponsorInvoice.update({ where: { id: inv.id }, data: { dunningLevel: step, dunnedAt: now } });
    stats.dunned++;
  }
  return stats;
}

/** Campaign year shown in the portal and dashboard: the newest started campaign, else next year from October on. */
export async function currentSponsorYear(tenantId: string, now = new Date()) {
  const c = await prisma.sponsorCampaign.findFirst({ where: { tenantId }, orderBy: { year: "desc" } });
  const fallback = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  return c && c.year >= now.getFullYear() ? c.year : fallback;
}
