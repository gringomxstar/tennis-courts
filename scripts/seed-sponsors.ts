// 10 fictitious sponsors with catalog, contracts, invoices and checklist, for trying out the module.
// No e-mail addresses on purpose: the DB is shared with production, so nothing can be mailed to anyone.
//   npx tsx scripts/seed-sponsors.ts tc-marly           create
//   npx tsx scripts/seed-sponsors.ts tc-marly --remove  delete everything this script created
import { PrismaClient } from "@prisma/client";
import { DISCOUNT, DAY, yearlyAmount } from "../src/lib/sponsoring";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const MARK = "[Testdaten]";

const ITEMS = [
  { name: "Hauptsponsor", price: 5000, capacity: 1, badge: "Exklusiv", deliverables: ["Logo auf Clubshirts", "Logo gross auf Website", "Einladung Sponsoren-Apéro"], description: "Grösste Sichtbarkeit: Shirts, Website, Clubhaus." },
  { name: "Blache am Platz", price: 600, capacity: 24, badge: "Bestseller", deliverables: ["Blache aufhängen", "Logo auf Website"], description: "Blache 3 × 1 m am Platzzaun, Druck inbegriffen." },
  { name: "Tischset", price: 250, capacity: null, badge: null, deliverables: ["Logo auf Tischset"], description: "Logo auf den Tischsets im Clubrestaurant." },
  { name: "Container", price: 1500, capacity: 1, badge: "Exklusiv", deliverables: ["Container beschriften"], description: "Ganze Seite des Materialcontainers." },
  { name: "Centre Court", price: 2500, capacity: 1, badge: "Exklusiv", deliverables: ["Branding Centre Court", "Einladung Sponsoren-Apéro"], description: "Namensrecht und Branding am Centre Court." },
  { name: "Turnier-Sponsor", price: 800, capacity: 4, badge: null, deliverables: ["Erwähnung am Clubturnier", "Einladung Sponsoren-Apéro"], description: "Partner des Clubturniers im Juni." },
  { name: "Logo auf Website", price: 150, capacity: null, badge: null, deliverables: ["Logo auf Website"], description: "Logo mit Link auf der Sponsorenseite." },
];

type C = { start: number; years: number; items: [string, number][]; invoices?: { year: number; issued: string; paid?: string; dunning?: number }[]; done?: number };
const SPONSORS: { name: string; contact: string; street: string; zip: string; city: string; contracts?: C[]; request?: { year: number; status: "REQUESTED" | "REMINDED" | "DECLINED"; daysAgo: number } }[] = [
  { name: "Garage Moser AG", contact: "Peter Moser", street: "Industriestrasse 14", zip: "1723", city: "Marly",
    contracts: [{ start: 2025, years: 3, items: [["Hauptsponsor", 1]], invoices: [{ year: 2025, issued: "2025-03-10", paid: "2025-03-28" }, { year: 2026, issued: "2026-03-10", paid: "2026-04-02" }], done: 3 }] },
  { name: "Immobilien Rossier SA", contact: "Claire Rossier", street: "Route de Fribourg 40", zip: "1723", city: "Marly",
    contracts: [{ start: 2026, years: 1, items: [["Container", 1]], invoices: [{ year: 2026, issued: "2026-03-12", paid: "2026-03-30" }], done: 1 }] },
  { name: "Café du Lac", contact: "Marco Bianchi", street: "Rue du Lac 3", zip: "1700", city: "Fribourg",
    contracts: [{ start: 2026, years: 1, items: [["Blache am Platz", 2], ["Tischset", 1]], invoices: [{ year: 2026, issued: "2026-03-12", paid: "2026-04-10" }], done: 2 }] },
  { name: "Elektro Brügger GmbH", contact: "Urs Brügger", street: "Gewerbeweg 8", zip: "1712", city: "Tafers",
    contracts: [{ start: 2026, years: 1, items: [["Blache am Platz", 1]], invoices: [{ year: 2026, issued: "2026-08-01", dunning: 1 }], done: 1 }] },
  { name: "Bäckerei Aebischer", contact: "Anna Aebischer", street: "Dorfstrasse 21", zip: "1723", city: "Marly",
    contracts: [{ start: 2026, years: 1, items: [["Tischset", 1]], invoices: [{ year: 2026, issued: "2026-03-12", paid: "2026-03-20" }], done: 1 }],
    request: { year: 2027, status: "REMINDED", daysAgo: 20 } },
  { name: "Treuhand Jungo", contact: "Daniel Jungo", street: "Bahnhofplatz 2", zip: "1700", city: "Fribourg",
    contracts: [{ start: 2026, years: 2, items: [["Logo auf Website", 1], ["Turnier-Sponsor", 1]], invoices: [{ year: 2026, issued: "2026-03-12", paid: "2026-03-25" }], done: 2 }] },
  { name: "Physio Bulliard", contact: "Sophie Bulliard", street: "Chemin des Pommiers 5", zip: "1723", city: "Marly",
    contracts: [{ start: 2025, years: 1, items: [["Blache am Platz", 1]], invoices: [{ year: 2025, issued: "2025-03-10", paid: "2025-04-01" }], done: 2 }] },
  { name: "Sanitär Kolly", contact: "Michel Kolly", street: "Route du Centre 17", zip: "1724", city: "Le Mouret",
    contracts: [{ start: 2026, years: 2, items: [["Centre Court", 1]], invoices: [{ year: 2026, issued: "2026-09-25" }], done: 0 }] },
  { name: "Weinhandlung Clément", contact: "Luc Clément", street: "Grand-Rue 30", zip: "1700", city: "Fribourg" },
  { name: "Velo Schafer", contact: "Nina Schafer", street: "Hauptstrasse 9", zip: "1712", city: "Tafers",
    request: { year: 2027, status: "DECLINED", daysAgo: 5 } },
];

async function remove(tenantId: string) {
  const ids = (await prisma.sponsor.findMany({ where: { tenantId, notes: { startsWith: MARK } }, select: { id: true } })).map((s) => s.id);
  await prisma.auditLog.deleteMany({ where: { tenantId, entityType: "Sponsor", entityId: { in: ids } } });
  const { count } = await prisma.sponsor.deleteMany({ where: { id: { in: ids } } }); // cascades contracts, invoices, checklist, tasks
  const items = await prisma.sponsorItem.deleteMany({ where: { tenantId, description: { endsWith: MARK }, lines: { none: {} } } });
  console.log(`${count} Testsponsoren und ${items.count} Katalog-Einträge gelöscht.`);
}

async function main() {
  const [slug, flag] = process.argv.slice(2);
  const t = await prisma.tenant.findUnique({ where: { slug: slug ?? "" } });
  if (!t) throw new Error("Club-Slug angeben, z.B. tc-marly");
  if (flag === "--remove") return remove(t.id);
  if (await prisma.sponsor.count({ where: { tenantId: t.id, notes: { startsWith: MARK } } })) throw new Error("Testdaten existieren schon (zuerst --remove).");

  const owner = await prisma.tenantUser.findFirst({ where: { tenantId: t.id, role: "CLUB_ADMIN" } });
  const items = new Map<string, { id: string; price: number }>();
  for (const [i, it] of ITEMS.entries()) {
    const found = await prisma.sponsorItem.findFirst({ where: { tenantId: t.id, name: it.name } });
    const row = found ?? (await prisma.sponsorItem.create({ data: { ...it, description: `${it.description} ${MARK}`, tenantId: t.id, sortOrder: i } }));
    items.set(it.name, { id: row.id, price: Number(row.price) });
  }
  let number = ((await prisma.sponsorInvoice.aggregate({ where: { tenantId: t.id }, _max: { number: true } }))._max.number ?? 1000) + 1;

  for (const s of SPONSORS) {
    const sp = await prisma.sponsor.create({
      data: {
        tenantId: t.id, name: s.name, street: s.street, zip: s.zip, city: s.city, token: randomBytes(18).toString("base64url"), ownerId: owner?.userId ?? null,
        notes: `${MARK} Fiktiver Sponsor zum Ausprobieren.`, contacts: { create: { name: s.contact, isPrimary: true } },
      },
    });
    const log = (text: string, at: Date) => prisma.auditLog.create({ data: { tenantId: t.id, action: "SPONSOR", entityType: "Sponsor", entityId: sp.id, metadataJson: { text }, createdAt: at } });
    await log("Sponsor erfasst (Testdaten)", new Date("2025-01-15"));
    for (const c of s.contracts ?? []) {
      const lines = c.items.map(([n, q]) => ({ itemId: items.get(n)!.id, quantity: q, unitPrice: items.get(n)!.price }));
      const contract = await prisma.sponsorContract.create({
        data: { sponsorId: sp.id, startYear: c.start, years: c.years, discountPct: DISCOUNT[c.years], source: "admin", createdAt: new Date(`${c.start}-02-20`), lines: { create: lines } },
      });
      const amount = yearlyAmount(lines, DISCOUNT[c.years]);
      await log(`Vertrag ${c.start}${c.years > 1 ? `–${c.start + c.years - 1}` : ""}: ${c.items.map(([n, q]) => `${q > 1 ? `${q}× ` : ""}${n}`).join(", ")}`, new Date(`${c.start}-02-20`));
      for (let y = c.start; y < c.start + c.years; y++) {
        await prisma.sponsorRequest.create({ data: { sponsorId: sp.id, year: y, status: "CONFIRMED", sentAt: new Date(`${y - 1}-11-01`), respondedAt: new Date(`${y}-02-20`) } }).catch(() => {});
      }
      for (const inv of c.invoices ?? []) {
        const issued = new Date(inv.issued);
        await prisma.sponsorInvoice.create({
          data: {
            tenantId: t.id, number: number++, sponsorId: sp.id, contractId: contract.id, year: inv.year, amount, issuedAt: issued, sentAt: issued,
            dueAt: new Date(issued.getTime() + 30 * DAY), paidAt: inv.paid ? new Date(inv.paid) : null,
            dunningLevel: inv.dunning ?? 0, dunnedAt: inv.dunning ? new Date(issued.getTime() + 40 * DAY) : null,
          },
        });
        if (inv.paid) await log(`Rechnung ${inv.year} bezahlt`, new Date(inv.paid));
      }
      // checklist for the latest billed year, the first `done` entries ticked
      const year = Math.min(c.start + c.years - 1, 2026);
      const labels = [...new Set(c.items.flatMap(([n]) => ITEMS.find((i) => i.name === n)!.deliverables))];
      await prisma.sponsorDeliverable.createMany({ data: labels.map((label, i) => ({ sponsorId: sp.id, year, label, doneAt: i < (c.done ?? 0) ? new Date(`${year}-05-01`) : null })), skipDuplicates: true });
    }
    if (s.request) {
      const at = new Date(Date.now() - s.request.daysAgo * DAY);
      await prisma.sponsorRequest.create({
        data: { sponsorId: sp.id, year: s.request.year, status: s.request.status, sentAt: at, reminders: s.request.status === "REMINDED" ? 1 : 0, remindedAt: s.request.status === "REMINDED" ? at : null, respondedAt: s.request.status === "DECLINED" ? at : null },
      });
      await log(s.request.status === "DECLINED" ? `Absage ${s.request.year}` : `Erinnerung ${s.request.year} verschickt`, at);
    }
  }
  console.log(`10 Testsponsoren im ${t.name} angelegt. Entfernen: npx tsx scripts/seed-sponsors.ts ${slug} --remove`);
}

main().finally(() => prisma.$disconnect());
