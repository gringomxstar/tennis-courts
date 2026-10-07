// 10 fictitious sponsors with a 16-item catalog, contracts, invoices and checklist, for trying out the module.
// No e-mail addresses on purpose: the DB is shared with production, so nothing can be mailed to anyone.
//   npx tsx scripts/seed-sponsors.ts tc-marly           create
//   npx tsx scripts/seed-sponsors.ts tc-marly --katalog only the catalog (16 items with placeholder photos)
//   npx tsx scripts/seed-sponsors.ts tc-marly --remove  delete everything this script created
import { PrismaClient } from "@prisma/client";
import { DISCOUNT, DAY, yearlyAmount } from "../src/lib/sponsoring";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const MARK = "[Testdaten]";

// Prices: research estimate for a Swiss club with 300–600 members (no public club price lists found), fictitious.
const ITEMS: { name: string; price: number; capacity: number | null; badge: string | null; description: string; deliverables: string[] }[] = [
  { name: "Hauptsponsor", price: 8000, capacity: 1, badge: "Exklusiv", description: "Exklusive Präsenz als Hauptpartner des Clubs auf Anlage, Web und Kommunikation.", deliverables: ["Logo auf Website und Briefpapier", "Grossblache beim Haupteingang", "Nennung an Turnieren und Anlässen", "Einladung Sponsoren-Apéro"] },
  { name: "Centre Court (Namensrecht)", price: 6000, capacity: 1, badge: "Exklusiv", description: "Der Hauptplatz trägt ein Jahr lang den Namen des Sponsors.", deliverables: ["Platzname auf Schild und Website", "Grossblache am Centre Court", "Namensnennung bei Turnierdurchsagen"] },
  { name: "Co-Sponsor", price: 4000, capacity: 3, badge: "Beliebt", description: "Partnerschaft auf zweiter Stufe mit Präsenz auf Anlage und Website.", deliverables: ["Logo auf Website", "Blache am Platz", "Newsletter-Erwähnung", "Einladung Sponsoren-Apéro"] },
  { name: "Container (Branding)", price: 3500, capacity: 1, badge: "Exklusiv", description: "Materialcontainer an gut sichtbarer Lage mit exklusivem Branding.", deliverables: ["Container gestalten und beschriften", "Logo auf Website"] },
  { name: "Interclub-Teamtrikots", price: 2500, capacity: 2, badge: null, description: "Logo auf den Teamshirts der Interclub-Mannschaften.", deliverables: ["Logo auf Teamshirts", "Nennung bei Interclub-Berichten", "Logo auf Website"] },
  { name: "Turniersponsor", price: 2000, capacity: 3, badge: "Beliebt", description: "Namensgebung eines Clubturniers mit Auftritt vor Ort.", deliverables: ["Turniername mit Sponsor", "Blache am Turniertag", "Preisübergabe durch Sponsor"] },
  { name: "Grossblache am Platz", price: 1500, capacity: 8, badge: "Bestseller", description: "Grosse Werbeblache (ca. 3 × 1 m) am Platzzaun.", deliverables: ["Blache aufhängen", "Logo auf Website"] },
  { name: "Sponsoren-Apéro-Paket", price: 1500, capacity: 2, badge: "Neu", description: "Sponsor gestaltet einen Clubanlass mit Apéro und Präsenz.", deliverables: ["Apéro am Clubanlass", "Nennung im Newsletter", "Roll-up auf der Terrasse"] },
  { name: "Junioren-Patenschaft", price: 1200, capacity: 4, badge: null, description: "Unterstützung der Juniorenförderung mit sichtbarer Nennung.", deliverables: ["Logo auf Juniorenshirts", "Nennung auf Website", "Einladung Juniorenturnier"] },
  { name: "Anzeigetafel Clubhaus", price: 900, capacity: 6, badge: "Neu", description: "Werbeeinblendung auf dem Bildschirm im Clubhaus.", deliverables: ["Einblendung im Slideshow-Loop", "Logo auf Website"] },
  { name: "Netz- und Schiedsrichterstuhl", price: 800, capacity: 4, badge: null, description: "Logo am Schiedsrichterstuhl oder Netzband auf einem Platz.", deliverables: ["Logo montieren", "Nennung auf Website"] },
  { name: "Tischset Clubrestaurant", price: 700, capacity: 10, badge: null, description: "Logo auf den Tischsets im Clubrestaurant.", deliverables: ["Tischsets drucken und auflegen", "Logo auf Website"] },
  { name: "Ballsponsor", price: 600, capacity: 3, badge: null, description: "Logo auf der Ballbox für Training und Clubturniere.", deliverables: ["Logo auf Ballbox", "Nennung im Newsletter"] },
  { name: "Blache klein", price: 500, capacity: 15, badge: "Bestseller", description: "Kleine Werbeblache (ca. 2 × 0.8 m) am Platzzaun.", deliverables: ["Blache aufhängen"] },
  { name: "Newsletter-Partner", price: 400, capacity: 4, badge: null, description: "Logo und Kurztext in den Club-Newslettern des Jahres.", deliverables: ["Logo in jedem Newsletter", "Logo auf Website"] },
  { name: "Gönner", price: 200, capacity: null, badge: null, description: "Einfache Unterstützung des Clubs mit Namensnennung.", deliverables: ["Eintrag auf Gönnertafel", "Nennung auf Website"] },
];

/** Placeholder photo: colored tile with the item name, clearly labelled as example. */
function placeholder(name: string, i: number) {
  const hue = (i * 47) % 360;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const words = name.split(" ");
  const lines: string[] = [];
  for (const w of words) (lines.length && (lines.at(-1)! + " " + w).length <= 14 ? (lines[lines.length - 1] += " " + w) : lines.push(w));
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,42%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},60%,28%)"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="320" cy="80" r="46" fill="#d7e84a" opacity=".9"/><path d="M286 60q34 20 68 0M286 100q34-20 68 0" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>${lines.map((l, j) => `<text x="32" y="${250 + j * 46 - (lines.length - 1) * 23}" font-family="Helvetica,Arial,sans-serif" font-size="40" font-weight="700" fill="#fff">${esc(l)}</text>`).join("")}<text x="32" y="372" font-family="Helvetica,Arial,sans-serif" font-size="20" fill="#fff" opacity=".75">Beispielbild</text></svg>`);
}

type C = { start: number; years: number; items: [string, number][]; invoices?: { year: number; issued: string; paid?: string; dunning?: number }[]; done?: number };
const SPONSORS: { name: string; contact: string; street: string; zip: string; city: string; contracts?: C[]; request?: { year: number; status: "REQUESTED" | "REMINDED" | "DECLINED"; daysAgo: number } }[] = [
  { name: "Garage Moser AG", contact: "Peter Moser", street: "Industriestrasse 14", zip: "1723", city: "Marly",
    contracts: [{ start: 2025, years: 3, items: [["Hauptsponsor", 1]], invoices: [{ year: 2025, issued: "2025-03-10", paid: "2025-03-28" }, { year: 2026, issued: "2026-03-10", paid: "2026-04-02" }], done: 3 }] },
  { name: "Immobilien Rossier SA", contact: "Claire Rossier", street: "Route de Fribourg 40", zip: "1723", city: "Marly",
    contracts: [{ start: 2026, years: 1, items: [["Container (Branding)", 1]], invoices: [{ year: 2026, issued: "2026-03-12", paid: "2026-03-30" }], done: 1 }] },
  { name: "Café du Lac", contact: "Marco Bianchi", street: "Rue du Lac 3", zip: "1700", city: "Fribourg",
    contracts: [{ start: 2026, years: 1, items: [["Grossblache am Platz", 2], ["Tischset Clubrestaurant", 1]], invoices: [{ year: 2026, issued: "2026-03-12", paid: "2026-04-10" }], done: 2 }] },
  { name: "Elektro Brügger GmbH", contact: "Urs Brügger", street: "Gewerbeweg 8", zip: "1712", city: "Tafers",
    contracts: [{ start: 2026, years: 1, items: [["Blache klein", 1]], invoices: [{ year: 2026, issued: "2026-08-01", dunning: 1 }], done: 1 }] },
  { name: "Bäckerei Aebischer", contact: "Anna Aebischer", street: "Dorfstrasse 21", zip: "1723", city: "Marly",
    contracts: [{ start: 2026, years: 1, items: [["Tischset Clubrestaurant", 1]], invoices: [{ year: 2026, issued: "2026-03-12", paid: "2026-03-20" }], done: 1 }],
    request: { year: 2027, status: "REMINDED", daysAgo: 20 } },
  { name: "Treuhand Jungo", contact: "Daniel Jungo", street: "Bahnhofplatz 2", zip: "1700", city: "Fribourg",
    contracts: [{ start: 2026, years: 2, items: [["Newsletter-Partner", 1], ["Turniersponsor", 1]], invoices: [{ year: 2026, issued: "2026-03-12", paid: "2026-03-25" }], done: 2 }] },
  { name: "Physio Bulliard", contact: "Sophie Bulliard", street: "Chemin des Pommiers 5", zip: "1723", city: "Marly",
    contracts: [{ start: 2025, years: 1, items: [["Grossblache am Platz", 1]], invoices: [{ year: 2025, issued: "2025-03-10", paid: "2025-04-01" }], done: 2 }] },
  { name: "Sanitär Kolly", contact: "Michel Kolly", street: "Route du Centre 17", zip: "1724", city: "Le Mouret",
    contracts: [{ start: 2026, years: 2, items: [["Centre Court (Namensrecht)", 1]], invoices: [{ year: 2026, issued: "2026-09-25" }], done: 0 }] },
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
  const onlyCatalog = flag === "--katalog";
  if (!onlyCatalog && await prisma.sponsor.count({ where: { tenantId: t.id, notes: { startsWith: MARK } } })) throw new Error("Testdaten existieren schon (zuerst --remove).");

  const owner = await prisma.tenantUser.findFirst({ where: { tenantId: t.id, role: "CLUB_ADMIN" } });
  const items = new Map<string, { id: string; price: number }>();
  for (const [i, it] of ITEMS.entries()) {
    const found = await prisma.sponsorItem.findFirst({ where: { tenantId: t.id, name: it.name } });
    const data = { ...it, description: `${it.description} ${MARK}`, sortOrder: i, image: placeholder(it.name, i), imageType: "image/svg+xml" };
    const row = found ? await prisma.sponsorItem.update({ where: { id: found.id }, data }) : await prisma.sponsorItem.create({ data: { ...data, tenantId: t.id } });
    items.set(it.name, { id: row.id, price: Number(row.price) });
  }
  if (onlyCatalog) return void console.log(`${ITEMS.length} Leistungen im Katalog von ${t.name} erfasst.`);
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
