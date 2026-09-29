import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { seasonEnd } from "@/lib/membership";

/**
 * Fixed demo personas. Their passwords live in the repo, so src/auth.ts refuses them unless a club
 * they belong to has settingsJson.demoMode on. The platform super-admin is deliberately not here.
 */
export const DEMO_ACCOUNTS = {
  "member@marly.ch": { password: "tennis12345", role: "MEMBER", firstName: "Roger", lastName: "Federer", label: "Mitglied" },
  "coach@marly.ch": { password: "coach12345", role: "COACH", firstName: "Heinz", lastName: "Günthardt", label: "Trainer" },
  "clubadmin@marly.ch": { password: "admin12345", role: "CLUB_ADMIN", firstName: "Marc", lastName: "Rosset", label: "Admin" },
} as const;

export type DemoEmail = keyof typeof DEMO_ACCOUNTS;

export const isDemoEmail = (email: string | null | undefined): email is DemoEmail =>
  Boolean(email && Object.hasOwn(DEMO_ACCOUNTS, email));

export const demoModeOn = (settingsJson: unknown) =>
  (settingsJson as { demoMode?: boolean } | null)?.demoMode === true;

/** Idempotent: create/repair the personas for this club (password, role, Abo for the member, wallet). */
export async function ensureDemoAccounts(tenantId: string) {
  const cheapest = await prisma.membershipPlan.findFirst({
    where: { tenantId, status: "ACTIVE", price: { gt: 0 } }, // not the free "Pay & Play" plan
    orderBy: { price: "asc" },
  });
  for (const [email, p] of Object.entries(DEMO_ACCOUNTS)) {
    const existing = await prisma.user.findUnique({ where: { email } });
    const passwordOk = existing?.passwordHash ? await bcrypt.compare(p.password, existing.passwordHash) : false;
    const passwordHash = passwordOk ? undefined : await bcrypt.hash(p.password, 10);
    const user = existing
      ? passwordHash
        ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
        : existing
      : await prisma.user.create({
          data: { email, firstName: p.firstName, lastName: p.lastName, passwordHash: passwordHash!, emailVerified: new Date() },
        });
    await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role: p.role },
      update: { role: p.role, status: "ACTIVE" },
    });
    await prisma.userWallet.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id },
      update: {},
    });
    if (p.role === "MEMBER" && cheapest) {
      const active = await prisma.membership.findFirst({ where: { tenantId, userId: user.id, status: "ACTIVE" } });
      if (!active) {
        const now = new Date();
        await prisma.membership.create({
          data: {
            tenantId,
            userId: user.id,
            membershipPlanId: cheapest.id,
            startsAt: now,
            endsAt: seasonEnd(now),
          },
        });
      }
    }
  }
}

/**
 * "Demo-Daten löschen": everything the personas left behind in this club — their bookings,
 * their spots in other bookings, blocks the demo admin created, wallet history. The accounts,
 * roles and the member's demo Abo stay, so demo mode can be switched on again. No Stripe refunds.
 */
export async function purgeDemoData(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { email: { in: Object.keys(DEMO_ACCOUNTS) }, tenantUsers: { some: { tenantId } } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) return { bookings: 0, blocks: 0 };
  const [bookings, , blocks] = await prisma.$transaction([
    prisma.booking.deleteMany({ where: { tenantId, organizerId: { in: ids } } }),
    prisma.bookingParticipant.deleteMany({ where: { userId: { in: ids }, booking: { tenantId } } }),
    prisma.courtBlock.deleteMany({ where: { tenantId, createdById: { in: ids } } }),
    prisma.walletTransaction.deleteMany({ where: { wallet: { tenantId, userId: { in: ids } } } }),
    prisma.userWallet.updateMany({ where: { tenantId, userId: { in: ids } }, data: { balance: 0 } }),
  ]);
  return { bookings: bookings.count, blocks: blocks.count };
}
