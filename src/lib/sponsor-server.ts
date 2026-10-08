import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { getStripe } from "@/lib/stripe";
import { DISCOUNT, contractEnd, coversYear, renewalReminderDue, PAYMENT_DAYS, DAY, campaignStep, chf, confirmedLines, dunningStep, hasYear, holdsPlace, lineInYear, parseAddress, unbilledLines, yearlyAmount } from "@/lib/sponsoring";
import type { TenantSettings } from "@/types";

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

/** Drops Stripe reservations whose checkout ran out (plus 10 min for late webhooks) and contracts left empty. */
export async function purgeExpiredCheckouts(db: Prisma.TransactionClient = prisma) {
  const { count } = await db.sponsorContractLine.deleteMany({ where: { pendingUntil: { lt: new Date() } } });
  if (count) await db.sponsorContract.deleteMany({ where: { lines: { none: {} } } });
}

/** Places taken per item in a year: confirmed lines plus running checkouts (cancelled contracts excluded). */
export async function takenByItem(tenantId: string, year: number, db: Prisma.TransactionClient = prisma) {
  const lines = await db.sponsorContractLine.findMany({
    where: { contract: { sponsor: { tenantId }, cancelledAt: null, startYear: { lte: year, gt: year - 3 } } },
    select: { itemId: true, quantity: true, fromYear: true, pendingUntil: true, contract: { select: { startYear: true, years: true } } },
  });
  const taken = new Map<string, number>();
  const now = new Date();
  for (const l of lines) if (holdsPlace(l.contract, l, year, now)) taken.set(l.itemId, (taken.get(l.itemId) ?? 0) + l.quantity);
  return taken;
}

/** Stripe checkout: Stripe ends the session after 30 min, the place stays held 10 min longer for a late webhook. */
export const CHECKOUT_MINUTES = 30;
const HOLD_MS = (CHECKOUT_MINUTES + 10) * 60_000;

/**
 * Buys catalog items for `year`: a new contract (1–3 years, duration discount) or, if the sponsor already
 * has one running that year, an add-on until that contract ends with its discount (owner 2026-10-07: full
 * yearly price, no pro rata). Checks free places for every year under a per-club lock. With `hold` the lines
 * are only reserved (Stripe checkout); confirmPurchase() makes them count and bills them.
 */
export async function buyItems(o: {
  tenantId: string; sponsorId: string; year: number; years: number;
  lines: { itemId: string; quantity: number }[]; source: "portal" | "admin" | "import"; actorId: string | null; hold?: boolean;
}) {
  const lines = o.lines.filter((l) => l.quantity > 0);
  if (!lines.length) throw new Error("Bitte mindestens eine Leistung wählen.");
  const res = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sponsor:" + o.tenantId}))`;
    await purgeExpiredCheckouts(tx);
    const sponsor = await tx.sponsor.findFirst({ where: { id: o.sponsorId, tenantId: o.tenantId }, include: { contracts: { where: { cancelledAt: null }, include: { lines: true } } } });
    if (!sponsor) throw new Error("Sponsor nicht gefunden.");
    const running = sponsor.contracts.find((c) => hasYear(c, o.year));
    const years = running ? running.startYear + running.years - o.year : o.years;
    if (!running && ![1, 2, 3].includes(years)) throw new Error("Laufzeit 1, 2 oder 3 Jahre.");
    if (!running) for (let y = o.year; y < o.year + years; y++) if (sponsor.contracts.some((c) => hasYear(c, y))) throw new Error(`Für ${y} besteht bereits ein Vertrag.`);
    const items = await tx.sponsorItem.findMany({ where: { tenantId: o.tenantId, id: { in: lines.map((l) => l.itemId) }, active: true } });
    if (items.length !== new Set(lines.map((l) => l.itemId)).size) throw new Error("Eine Leistung ist nicht mehr im Katalog.");
    for (let y = o.year; y < o.year + years; y++) {
      const taken = await takenByItem(o.tenantId, y, tx);
      for (const l of lines) {
        const it = items.find((i) => i.id === l.itemId)!;
        if (it.capacity != null && (taken.get(it.id) ?? 0) + l.quantity > it.capacity) throw new Error(`«${it.name}» ist ${y} bereits vergeben.`);
      }
    }
    const pendingUntil = o.hold ? new Date(Date.now() + HOLD_MS) : null;
    const data = lines.map((l) => ({
      itemId: l.itemId, quantity: l.quantity, unitPrice: items.find((i) => i.id === l.itemId)!.price,
      fromYear: running ? o.year : null, pendingUntil,
    }));
    const contract = running
      ? running
      : await tx.sponsorContract.create({ data: { sponsorId: o.sponsorId, startYear: o.year, years, discountPct: DISCOUNT[years], source: o.source } });
    const created = await Promise.all(data.map((d) => tx.sponsorContractLine.create({ data: { ...d, contractId: contract.id } })));
    const amount = yearlyAmount(created.map((l) => ({ quantity: l.quantity, unitPrice: Number(l.unitPrice) })), contract.discountPct);
    const what = created.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ""}${items.find((i) => i.id === l.itemId)!.name}`).join(", ");
    return { contract, lineIds: created.map((l) => l.id), amount, what, addOn: Boolean(running) };
  });
  return res;
}

/** Purchase is final (invoice chosen, or Stripe paid): confirm the year, log, bill the new lines. */
export async function confirmPurchase(o: {
  tenantId: string; sponsorId: string; contractId: string; year: number; lineIds: string[]; actorId: string | null; source: string;
  paid?: { at: Date; stripeSessionId: string };
}) {
  await prisma.sponsorContractLine.updateMany({ where: { id: { in: o.lineIds } }, data: { pendingUntil: null } });
  await prisma.sponsorRequest.upsert({
    where: { sponsorId_year: { sponsorId: o.sponsorId, year: o.year } },
    create: { sponsorId: o.sponsorId, year: o.year, status: "CONFIRMED", respondedAt: new Date() },
    update: { status: "CONFIRMED", respondedAt: new Date() },
  });
  await prisma.sponsor.update({ where: { id: o.sponsorId }, data: { stage: "WON" } });
  // the sponsor answered: the "no answer" task is obsolete
  await prisma.sponsorTask.updateMany({ where: { sponsorId: o.sponsorId, doneAt: null, title: NO_ANSWER(o.year) }, data: { doneAt: new Date() } });
  const c = await prisma.sponsorContract.findUniqueOrThrow({ where: { id: o.contractId }, include: { lines: { where: { id: { in: o.lineIds } }, include: { item: true } } } });
  const end = c.startYear + c.years - 1;
  const amount = yearlyAmount(c.lines.map((l) => ({ quantity: l.quantity, unitPrice: Number(l.unitPrice) })), c.discountPct);
  const what = c.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ""}${l.item.name}`).join(", ");
  const addOn = c.lines.some((l) => l.fromYear != null);
  await logSponsor(o.tenantId, o.sponsorId, o.actorId,
    `${addOn ? `Zusatz ab ${o.year}` : `Vertrag ${c.startYear}`}${end > o.year ? `–${end}` : ""}: ${what}, ${chf(amount)}/Jahr${c.discountPct ? ` (−${c.discountPct} %)` : ""}` +
    (o.paid ? " · online bezahlt" : o.source === "portal" ? " · online bestätigt" : ""));
  return billYear(o.contractId, o.year, o.paid);
}

/** Stripe webhook: checkout paid → lines confirmed, invoice marked paid. Idempotent per session. */
export async function confirmSponsorCheckout(sessionId: string, at = new Date()) {
  const done = await prisma.sponsorInvoice.findUnique({ where: { stripeSessionId: sessionId } });
  if (done) return done;
  const lines = await prisma.sponsorContractLine.findMany({ where: { stripeSessionId: sessionId }, include: { contract: { include: { sponsor: { include: { owner: true } } } } } });
  if (!lines.length) {
    console.error(`Sponsoring: bezahlte Checkout-Session ${sessionId} ohne Positionen (Reservation abgelaufen?)`);
    return null;
  }
  const c = lines[0].contract;
  const year = lines[0].fromYear ?? c.startYear;
  const inv = await confirmPurchase({
    tenantId: c.sponsor.tenantId, sponsorId: c.sponsorId, contractId: c.id, year, lineIds: lines.map((l) => l.id),
    actorId: null, source: "portal", paid: { at, stripeSessionId: sessionId },
  });
  if (c.sponsor.owner?.email && inv) {
    await sendMail(c.sponsor.owner.email, `Sponsoring ${year} bezahlt: ${c.sponsor.name}`, `${c.sponsor.name} hat online ${chf(Number(inv.amount))} bezahlt (Rechnung Nr. ${inv.number}).`);
  }
  return inv;
}

/**
 * Sponsor starts a new purchase (or cancels) while an own checkout is still open: end it at Stripe.
 * Paid in the meantime → confirm it; otherwise free the places.
 */
export async function settleOwnCheckouts(sponsorId: string) {
  const open = await prisma.sponsorContractLine.findMany({ where: { pendingUntil: { not: null }, stripeSessionId: { not: null }, contract: { sponsorId } }, select: { stripeSessionId: true }, distinct: ["stripeSessionId"] });
  for (const { stripeSessionId: id } of open) {
    const stripe = getStripe();
    await stripe.checkout.sessions.expire(id!).catch(() => null); // already completed/expired: fine
    const paid = await stripe.checkout.sessions.retrieve(id!).then((x) => x.payment_status === "paid").catch(() => false);
    if (paid) await confirmSponsorCheckout(id!);
    else await releaseSponsorCheckout(id!);
  }
}

/** Stripe checkout expired or cancelled: free the reserved places right away. */
export async function releaseSponsorCheckout(sessionId: string) {
  await prisma.sponsorContractLine.deleteMany({ where: { stripeSessionId: sessionId, pendingUntil: { not: null } } });
  await prisma.sponsorContract.deleteMany({ where: { lines: { none: {} } } });
}

/**
 * Bills a contract year: all confirmed lines of that year no invoice covers yet (the yearly invoice, or
 * an add-on bought later), plus their deliverables. Idempotent. Mails the invoice, or the receipt if paid.
 */
export async function billYear(contractId: string, year: number, paid?: { at: Date; stripeSessionId: string }) {
  const c = await prisma.sponsorContract.findUnique({ where: { id: contractId }, include: { lines: { include: { item: true } }, sponsor: true } });
  if (!c || !hasYear(c, year)) return null;
  const labels = [...new Set(confirmedLines(c, year).flatMap((l) => l.item.deliverables))];
  if (labels.length) {
    await prisma.sponsorDeliverable.createMany({ data: labels.map((label) => ({ sponsorId: c.sponsorId, year, label })), skipDuplicates: true });
  }
  const inv = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sponsor-inv:" + c.sponsor.tenantId}))`;
    const existing = await tx.sponsorInvoice.findMany({ where: { contractId, year }, select: { lines: true } });
    const todo = unbilledLines(c, year, existing);
    if (!todo.length) return null;
    const last = await tx.sponsorInvoice.aggregate({ where: { tenantId: c.sponsor.tenantId }, _max: { number: true } });
    const now = new Date();
    return tx.sponsorInvoice.create({
      data: {
        tenantId: c.sponsor.tenantId, sponsorId: c.sponsorId, contractId, year,
        amount: yearlyAmount(todo.map((l) => ({ quantity: l.quantity, unitPrice: Number(l.unitPrice) })), c.discountPct),
        lines: todo.map((l) => ({ lineId: l.id, name: l.item.name, quantity: l.quantity, unitPrice: Number(l.unitPrice) })),
        discountPct: c.discountPct,
        number: (last._max.number ?? 1000) + 1, issuedAt: now, dueAt: new Date(now.getTime() + PAYMENT_DAYS * DAY),
        ...(paid ? { paidAt: paid.at, paidVia: "stripe", stripeSessionId: paid.stripeSessionId } : {}),
      },
    });
  });
  if (!inv) return null;
  await logSponsor(c.sponsor.tenantId, c.sponsorId, null, `Rechnung Nr. ${inv.number} (${year}) über ${chf(Number(inv.amount))} ${paid ? "erstellt und online bezahlt" : "erstellt"}`);
  const notSent = await sendInvoiceMailWhy(inv.id);
  return Object.assign(inv, { notSent });
}

async function loadInvoice(invoiceId: string) {
  return prisma.sponsorInvoice.findUnique({
    where: { id: invoiceId },
    include: { sponsor: { include: { contacts: true, tenant: true } }, contract: true },
  });
}

/** Invoice mail (first time), receipt (paid online) or dunning mail (level 1/2). Marks sentAt on success. */
export async function sendInvoiceMail(invoiceId: string, dunning?: 1 | 2) {
  return !(await sendInvoiceMailWhy(invoiceId, dunning));
}

/** Sends the invoice (or reminder); null when sent, otherwise why not. Never sends a sample QR for money still owed. */
export async function sendInvoiceMailWhy(invoiceId: string, dunning?: 1 | 2): Promise<string | null> {
  const inv = await loadInvoice(invoiceId);
  if (!inv) return "Rechnung nicht gefunden";
  if (!inv.paidAt && (!(inv.sponsor.tenant.settingsJson as TenantSettings | null)?.invoiceIban || !parseAddress(inv.sponsor.tenant.address))) {
    // stays unsent; the daily run sends it once IBAN and address are in the settings
    return "IBAN oder Clubadresse fehlt in den Einstellungen";
  }
  const to = mainContact(inv.sponsor)?.email;
  if (!to) {
    if (!dunning && !inv.paidAt) await createTask(inv.sponsorId, `Rechnung Nr. ${inv.number} per Post senden (keine E-Mail-Adresse)`);
    return "Sponsor hat keine E-Mail-Adresse";
  }
  const s = inv.sponsor;
  const club = s.tenant.name;
  const due = inv.dueAt.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
  const end = inv.contract.startYear + inv.contract.years - 1;
  const running = inv.contract.years > 1 && inv.year > inv.contract.startYear;
  const receipt = Boolean(inv.paidAt) && !dunning;
  const subject = dunning === 2 ? `2. Mahnung: Rechnung Nr. ${inv.number}, ${club}` : dunning ? `Zahlungserinnerung: Rechnung Nr. ${inv.number}, ${club}`
    : receipt ? `Zahlung erhalten: Sponsoring ${inv.year}, ${club}` : `Rechnung Sponsoring ${inv.year}: ${club}`;
  const body = dunning
    ? [`für das Sponsoring ${inv.year} ist die Rechnung Nr. ${inv.number} über ${chf(Number(inv.amount))} (fällig am ${due}) noch offen.`, "Falls Sie bereits bezahlt haben, betrachten Sie diese Mail als gegenstandslos."]
    : receipt
      ? [`herzlichen Dank! Ihre Zahlung über ${chf(Number(inv.amount))} für das Sponsoring ${inv.year} ist eingegangen.${end > inv.year ? ` Ab ${inv.year + 1} erhalten Sie die Rechnung jeweils per E-Mail.` : ""}`, `Quittung Nr. ${inv.number}:`]
      : [
          running
            ? `Ihr Sponsoring-Vertrag läuft bis ${end}. Danke, dass Sie ${inv.year} wieder dabei sind.`
            : `herzlichen Dank für Ihr Sponsoring ${inv.year}.`,
          `Ihre Rechnung Nr. ${inv.number} über ${chf(Number(inv.amount))}, zahlbar bis ${due}:`,
        ];
  const ok = await sendMail(to, subject, [
    hello(s), "", ...body,
    receipt ? invoiceUrl(s.token, inv.id) : `Rechnung mit QR-Einzahlungsschein: ${invoiceUrl(s.token, inv.id)}`,
    "", `Logo, Auswahl und weitere Leistungen: ${portalUrl(s.token)}`, "", `Freundliche Grüsse`, club,
  ].join("\n"));
  if (!ok) return "Mailversand fehlgeschlagen";
  if (!dunning) {
    // first send after a delay (e.g. IBAN entered later): the sponsor still gets the full payment term
    const due = new Date(Date.now() + PAYMENT_DAYS * DAY);
    await prisma.sponsorInvoice.update({ where: { id: inv.id }, data: { sentAt: new Date(), ...(!inv.sentAt && !inv.paidAt && inv.dueAt < due ? { dueAt: due } : {}) } });
  }
  return null;
}

async function sendRequestMail(sponsorId: string, year: number, reminder: boolean) {
  const s = await prisma.sponsor.findUnique({ where: { id: sponsorId }, include: { contacts: true, tenant: true, contracts: { where: { cancelledAt: null }, include: { lines: true } } } });
  const to = s && mainContact(s)?.email;
  if (!s || !to) return false;
  const prev = s.contracts.some((c) => hasYear(c, year - 1));
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
  const sponsors = await prisma.sponsor.findMany({ where: { tenantId: o.tenantId }, include: { contracts: { where: { cancelledAt: null }, include: { lines: true } }, requests: { where: { year: o.year } } } });
  let running = 0, requested = 0;
  for (const s of sponsors) {
    const c = s.contracts.find((x) => hasYear(x, o.year));
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
  await purgeExpiredCheckouts();

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
    include: { lines: true },
  });
  for (const c of contracts) {
    if (!hasYear(c, thisYear) || budget <= 0) continue;
    budget--;
    await billYear(c.id, thisYear);
    stats.billed++;
  }

  // contract ends soon and nothing follows: one task per contract end
  const ending = await prisma.sponsorContract.findMany({
    where: { cancelledAt: null, startYear: { lte: thisYear, gt: thisYear - 4 }, ...(tenantId ? { sponsor: { tenantId } } : {}) },
    include: { sponsor: { include: { contracts: { where: { cancelledAt: null } } } } },
  });
  for (const c of ending) {
    const end = contractEnd(c)!;
    if (!renewalReminderDue(c, now) || end.getUTCFullYear() < thisYear || c.sponsor.contracts.some((x) => coversYear(x, end.getUTCFullYear() + 1))) continue;
    await createTask(c.sponsorId, `Vertrag endet am ${end.toLocaleDateString("de-CH", { timeZone: "UTC" })}: Verlängerung ansprechen`);
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
