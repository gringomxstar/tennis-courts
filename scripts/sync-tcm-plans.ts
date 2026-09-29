// Replace TC Marly's Abo plans with the real tariffs: `npx tsx scripts/sync-tcm-plans.ts [--apply]`
import { prisma } from "../src/lib/prisma";
import { TCM_PLANS } from "../prisma/tcm-plans";

const TENANT = "tc-marly";
const apply = process.argv.includes("--apply");

(async () => {
  const keep = new Set(TCM_PLANS.map((p) => p.id));
  const old = await prisma.membershipPlan.findMany({ where: { tenantId: TENANT, id: { notIn: [...keep] } }, include: { _count: { select: { memberships: true } } } });
  const used = old.filter((p) => p._count.memberships > 0);
  console.log(`${TCM_PLANS.length} TCM plans; delete ${old.length - used.length} old, deactivate ${used.length} in use`);
  if (!apply) return prisma.$disconnect();
  await prisma.$transaction([
    prisma.membershipPlan.deleteMany({ where: { id: { in: old.filter((p) => !p._count.memberships).map((p) => p.id) } } }),
    prisma.membershipPlan.updateMany({ where: { id: { in: used.map((p) => p.id) } }, data: { status: "INACTIVE" } }),
    ...TCM_PLANS.map(({ id, ...p }) =>
      prisma.membershipPlan.upsert({ where: { id }, create: { id, tenantId: TENANT, ...p }, update: { ...p, status: "ACTIVE" } })
    ),
  ]);
  console.log("done");
  await prisma.$disconnect();
})();
