// One-off, idempotent: sets Sponsor.stage from contracts/requests and turns Sponsor.notes into a SponsorNote.
//   DATABASE_URL=... npx tsx scripts/backfill-sponsor-crm.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sponsors = await prisma.sponsor.findMany({
    include: { contracts: { where: { cancelledAt: null }, select: { id: true } }, requests: { orderBy: { year: "desc" }, take: 1 }, noteList: { select: { text: true } } },
  });
  let stages = 0, notes = 0;
  for (const s of sponsors) {
    const stage = s.contracts.length ? "WON" : s.requests[0]?.status === "DECLINED" ? "LOST" : null;
    if (stage && s.stage !== stage) {
      await prisma.sponsor.update({ where: { id: s.id }, data: { stage } });
      stages++;
    }
    const text = s.notes?.trim();
    if (text && !s.noteList.some((n) => n.text === text)) {
      await prisma.sponsorNote.create({ data: { sponsorId: s.id, authorId: null, text, createdAt: s.createdAt } });
      notes++;
    }
  }
  console.log(`Stufen gesetzt: ${stages}, Notizen angelegt: ${notes}`);
}

main().finally(() => prisma.$disconnect());
