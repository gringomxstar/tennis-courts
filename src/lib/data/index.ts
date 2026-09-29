import { prisma } from "@/lib/prisma";
import { mockDb } from "./mock-db";
import {
  Tenant,
  TenantSettings,
  Court,
  CourtSurface,
  CourtStatus,
  Booking,
  BookingStatus,
  BookingType,
  ParticipantRole,
  InvitationStatus,
  CourtBlock,
  BlockReason,
  UserSummary,
  TenantRole,
  MembershipPlan,
  UserWallet,
  SportType,
} from "@/types";

// Determine if we should attempt database connection
const hasDbConfigured = Boolean(process.env.DATABASE_URL);

/**
 * mockDb is a dev convenience. In production a DB error must surface — silently serving
 * mock rows (wrong tenant ids) is what broke guest/Twint bookings under connection pressure.
 */
function dbFailed(e: unknown) {
  if (process.env.NODE_ENV === "production") throw e;
  console.warn("Prisma query failed, falling back to mockDb:", e);
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  if (hasDbConfigured) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
      });
      if (tenant) {
        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          timezone: tenant.timezone,
          address: tenant.address,
          email: tenant.email,
          phone: tenant.phone,
          status: tenant.status,
          settingsJson: tenant.settingsJson as unknown as TenantSettings | null,
        };
      }
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDb.getTenantBySlug(slug) || null;
}

export async function getAllTenants(): Promise<Tenant[]> {
  if (hasDbConfigured) {
    try {
      const tenants = await prisma.tenant.findMany({
        where: { status: "ACTIVE" },
      });
      if (tenants.length > 0) {
        return tenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          logoUrl: t.logoUrl,
          timezone: t.timezone,
          address: t.address,
          email: t.email,
          phone: t.phone,
          status: t.status,
          settingsJson: t.settingsJson as unknown as TenantSettings | null,
        }));
      }
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDb.tenants;
}

export async function getCourtsByTenantId(tenantId: string): Promise<Court[]> {
  if (hasDbConfigured) {
    try {
      const courts = await prisma.court.findMany({
        where: { tenantId },
        orderBy: { sortOrder: "asc" },
      });
      if (courts.length > 0) {
        return courts.map((c) => ({
          id: c.id,
          tenantId: c.tenantId,
          locationId: c.locationId,
          name: c.name,
          sportType: ((c as { sportType?: SportType }).sportType || "TENNIS") as SportType,
          surface: c.surface as CourtSurface,
          hourlyRate: Number((c as { hourlyRate?: unknown }).hourlyRate || 30),
          isIndoor: c.isIndoor,
          hasLighting: c.hasLighting,
          status: c.status as CourtStatus,
          sortOrder: c.sortOrder,
        }));
      }
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDb.getCourtsByTenantId(tenantId);
}

type PrismaBookingWithRelations = Awaited<
  ReturnType<typeof prisma.booking.findMany<{
    include: { organizer: true; participants: { include: { user: true } } };
  }>>
>[number];

function mapPrismaBooking(b: PrismaBookingWithRelations): Booking {
  return {
    id: b.id,
    tenantId: b.tenantId,
    courtId: b.courtId,
    organizerId: b.organizerId,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status as BookingStatus,
    bookingType: b.bookingType as BookingType,
    notes: b.notes || null,
    seriesId: b.idempotencyKey?.startsWith("series:") ? b.idempotencyKey.split(":")[1] : undefined,
    hasBallMachine: Boolean((b as { hasBallMachine?: boolean }).hasBallMachine),
    hasLighting: Boolean((b as { hasLighting?: boolean }).hasLighting),
    totalCost: Number((b as { totalCost?: unknown }).totalCost || 0),
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod ?? undefined,
    organizer: {
      id: b.organizer.id,
      firstName: b.organizer.firstName,
      lastName: b.organizer.lastName,
      email: b.organizer.email,
    },
    participants: b.participants.map((p) => ({
      id: p.id,
      bookingId: p.bookingId,
      userId: p.userId,
      guestName: p.guestName,
      guestEmail: p.guestEmail,
      role: p.role as ParticipantRole,
      invitationStatus: p.invitationStatus as InvitationStatus,
      user: p.user
        ? {
            id: p.user.id,
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            email: p.user.email,
          }
        : null,
    })),
  };
}

const bookingInclude = {
  organizer: true,
  participants: { include: { user: true } },
} as const;

function mergeById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const merged = [...primary];
  for (const item of extra) {
    if (!merged.some((m) => m.id === item.id)) merged.push(item);
  }
  return merged;
}

/** Non-cancelled bookings starting in [fromIso, toIso). */
export async function getBookingsInRange(
  tenantId: string,
  fromIso: string,
  toIso: string
): Promise<Booking[]> {
  const mock = mockDb.getBookingsInRange(tenantId, fromIso, toIso);
  if (hasDbConfigured) {
    try {
      const dbBookings = await prisma.booking.findMany({
        where: {
          tenantId,
          startsAt: { gte: new Date(fromIso), lt: new Date(toIso) },
          status: { not: "CANCELLED" },
        },
        include: bookingInclude,
      });
      return mergeById(dbBookings.map(mapPrismaBooking), mock);
    } catch (e) {
      dbFailed(e);
    }
  }
  return mock;
}

export async function getCourtBookings(
  tenantId: string,
  dateStr: string // YYYY-MM-DD
): Promise<Booking[]> {
  if (hasDbConfigured) {
    try {
      const dbBookings = await prisma.booking.findMany({
        where: {
          tenantId,
          startsAt: {
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`),
          },
          status: { not: "CANCELLED" },
        },
        include: bookingInclude,
      });
      return mergeById(dbBookings.map(mapPrismaBooking), mockDb.getBookings(tenantId, dateStr));
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDb.getBookings(tenantId, dateStr);
}

function mapPrismaBlock(b: {
  id: string;
  tenantId: string;
  courtId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  description: string | null;
  createdById: string;
}): CourtBlock {
  return {
    id: b.id,
    tenantId: b.tenantId,
    courtId: b.courtId,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    reason: b.reason as BlockReason,
    description: b.description || null,
    createdById: b.createdById,
  };
}

/** Blocks overlapping [fromIso, toIso). */
export async function getBlocksInRange(
  tenantId: string,
  fromIso: string,
  toIso: string
): Promise<CourtBlock[]> {
  const mock = mockDb.getBlocksInRange(tenantId, fromIso, toIso);
  if (hasDbConfigured) {
    try {
      const blocks = await prisma.courtBlock.findMany({
        where: {
          tenantId,
          startsAt: { lt: new Date(toIso) },
          endsAt: { gt: new Date(fromIso) },
        },
      });
      return mergeById(blocks.map(mapPrismaBlock), mock);
    } catch (e) {
      dbFailed(e);
    }
  }
  return mock;
}

export async function getCourtBlocks(
  tenantId: string,
  dateStr: string
): Promise<CourtBlock[]> {
  if (hasDbConfigured) {
    try {
      const blocks = await prisma.courtBlock.findMany({
        where: {
          tenantId,
          startsAt: {
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`),
          },
        },
      });
      return mergeById(blocks.map(mapPrismaBlock), mockDb.getCourtBlocks(tenantId, dateStr));
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDb.getCourtBlocks(tenantId, dateStr);
}

export async function getTenantMembers(tenantId: string): Promise<UserSummary[]> {
  if (hasDbConfigured) {
    try {
      const tenantUsers = await prisma.tenantUser.findMany({
        where: { tenantId },
        include: { user: true },
      });
      if (tenantUsers.length > 0) {
        return tenantUsers.map((tu) => ({
          id: tu.user.id,
          email: tu.user.email,
          firstName: tu.user.firstName,
          lastName: tu.user.lastName,
          phone: tu.user.phone,
          role: tu.role as TenantRole,
        }));
      }
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDb.getUsersByTenantId(tenantId);
}

/** Non-cancelled bookings in this club the user organizes or plays in. */
export async function getUserBookings(userId: string, tenantId: string): Promise<Booking[]> {
  const mock = mockDb.getAllUserBookings(userId).filter((b) => b.tenantId === tenantId);
  if (hasDbConfigured) {
    try {
      const dbBookings = await prisma.booking.findMany({
        where: {
          tenantId,
          // EXPIRED = abandoned checkout, never a real booking
          status: { notIn: ["CANCELLED", "EXPIRED"] },
          OR: [{ organizerId: userId }, { participants: { some: { userId } } }],
        },
        include: bookingInclude,
        orderBy: { startsAt: "asc" },
      });
      return mergeById(dbBookings.map(mapPrismaBooking), mock);
    } catch (e) {
      dbFailed(e);
    }
  }
  return mock;
}

export async function getMembershipPlansByTenantId(tenantId: string): Promise<MembershipPlan[]> {
  if (hasDbConfigured) {
    try {
      const plans = await prisma.membershipPlan.findMany({
        where: { tenantId, status: "ACTIVE" },
        orderBy: { price: "asc" },
      });
      if (plans.length > 0) {
        return plans.map(planFromDb);
      }
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDb.getMembershipPlans(tenantId);
}

type DbPlan = {
  id: string; tenantId: string; name: string; description: string | null; price: unknown; currency: string;
  bookingWindowDays: number; simultaneousBookingLimit: number; dailyBookingLimit: number; weeklyBookingLimit: number;
  allowedDurations: number[]; rulesJson: unknown;
};
const PLAN_RULE_KEYS = ["guestsPerWeek", "sports", "category", "persons", "ageMin", "ageMax", "proofRequired", "playWindow"] as const;

/** The plan's extra fields live in rulesJson (no migration per field). */
export function planFromDb(p: DbPlan): MembershipPlan {
  const r = (p.rulesJson ?? {}) as Partial<MembershipPlan>;
  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    description: p.description || null,
    price: Number(p.price),
    currency: p.currency,
    bookingWindowDays: p.bookingWindowDays,
    simultaneousBookingLimit: p.simultaneousBookingLimit,
    dailyBookingLimit: p.dailyBookingLimit,
    weeklyBookingLimit: p.weeklyBookingLimit,
    allowedDurations: p.allowedDurations,
    guestsPerWeek: r.guestsPerWeek ?? null,
    sports: r.sports?.length ? r.sports : ["TENNIS"],
    category: r.category ?? null,
    persons: r.persons === 2 ? 2 : 1,
    ageMin: r.ageMin ?? null,
    ageMax: r.ageMax ?? null,
    proofRequired: Boolean(r.proofRequired),
    playWindow: r.playWindow ?? null,
  };
}

function planRulesJson(plan: Partial<MembershipPlan>, base: unknown = {}) {
  const out: Record<string, unknown> = { ...((base ?? {}) as object) };
  for (const k of PLAN_RULE_KEYS) if (plan[k] !== undefined) out[k] = plan[k];
  return out as object;
}

export async function updateTenantSettings(
  slug: string,
  settings: Partial<TenantSettings>
): Promise<Tenant | null> {
  const updatedMock = mockDb.updateTenantSettings(slug, settings);
  if (hasDbConfigured) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (tenant) {
        const currentSettings = (tenant.settingsJson as Record<string, unknown>) || {};
        const mergedSettings = { ...currentSettings, ...settings };
        const updated = await prisma.tenant.update({
          where: { slug },
          data: {
            settingsJson: mergedSettings as object,
          },
        });
        return {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          logoUrl: updated.logoUrl,
          timezone: updated.timezone,
          address: updated.address,
          email: updated.email,
          phone: updated.phone,
          status: updated.status,
          settingsJson: updated.settingsJson as unknown as TenantSettings | null,
        };
      }
    } catch (e) {
      dbFailed(e);
    }
  }
  return updatedMock;
}

export async function createMembershipPlan(
  tenantId: string,
  plan: Omit<MembershipPlan, "id" | "tenantId">
): Promise<MembershipPlan> {
  const mockPlan = mockDb.createMembershipPlan({ ...plan, tenantId });
  if (hasDbConfigured) {
    try {
      const dbPlan = await prisma.membershipPlan.create({
        data: {
          tenantId,
          name: plan.name,
          description: plan.description || null,
          price: plan.price,
          currency: plan.currency || "CHF",
          bookingWindowDays: plan.bookingWindowDays,
          simultaneousBookingLimit: plan.simultaneousBookingLimit,
          dailyBookingLimit: plan.dailyBookingLimit,
          weeklyBookingLimit: plan.weeklyBookingLimit,
          allowedDurations: plan.allowedDurations,
          rulesJson: planRulesJson({ guestsPerWeek: null, ...plan }),
          status: "ACTIVE",
        },
      });
      return planFromDb(dbPlan);
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockPlan;
}

export async function updateMembershipPlan(
  planId: string,
  plan: Partial<MembershipPlan>
): Promise<MembershipPlan | null> {
  const mockUpdated = mockDb.updateMembershipPlan(planId, plan);
  if (hasDbConfigured) {
    try {
      const dbPlan = await prisma.membershipPlan.update({
        where: { id: planId },
        data: {
          ...(plan.name && { name: plan.name }),
          ...(plan.description !== undefined && { description: plan.description }),
          ...(plan.price !== undefined && { price: plan.price }),
          ...(plan.currency && { currency: plan.currency }),
          ...(plan.bookingWindowDays !== undefined && { bookingWindowDays: plan.bookingWindowDays }),
          ...(plan.simultaneousBookingLimit !== undefined && {
            simultaneousBookingLimit: plan.simultaneousBookingLimit,
          }),
          ...(plan.dailyBookingLimit !== undefined && { dailyBookingLimit: plan.dailyBookingLimit }),
          ...(plan.weeklyBookingLimit !== undefined && { weeklyBookingLimit: plan.weeklyBookingLimit }),
          ...(plan.allowedDurations && { allowedDurations: plan.allowedDurations }),
          ...(PLAN_RULE_KEYS.some((k) => plan[k] !== undefined) && {
            rulesJson: planRulesJson(plan, (await prisma.membershipPlan.findUnique({ where: { id: planId } }))?.rulesJson),
          }),
        },
      });
      return planFromDb(dbPlan);
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockUpdated;
}

export async function deleteMembershipPlan(planId: string): Promise<boolean> {
  const mockDeleted = mockDb.deleteMembershipPlan(planId);
  if (hasDbConfigured) {
    try {
      await prisma.membershipPlan.update({
        where: { id: planId },
        data: { status: "INACTIVE" },
      });
      return true;
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDeleted;
}

// Wallet functions
export async function getUserWallet(
  tenantId: string,
  userId: string
): Promise<UserWallet> {
  if (hasDbConfigured) {
    try {
      const dbWallet = await prisma.userWallet.findUnique({
        where: {
          tenantId_userId: { tenantId, userId },
        },
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (dbWallet) {
        return {
          id: dbWallet.id,
          tenantId: dbWallet.tenantId,
          userId: dbWallet.userId,
          balance: Number(dbWallet.balance),
          currency: dbWallet.currency,
          transactions: dbWallet.transactions.map((tx) => ({
            id: tx.id,
            walletId: tx.walletId,
            amount: Number(tx.amount),
            type: tx.type,
            description: tx.description,
            bookingId: tx.bookingId,
            createdAt: tx.createdAt.toISOString(),
          })),
        };
      }
      return { id: "", tenantId, userId, balance: 0, currency: "CHF", transactions: [] };
    } catch (e) {
      dbFailed(e);
    }
  }
  return mockDb.getWallet(tenantId, userId);
}

/** The user's role in this club and the plan of their active membership (fresh from the DB, not the JWT). */
export async function getMemberContext(
  tenantId: string,
  userId: string
): Promise<{ role: TenantRole | null; plan: MembershipPlan | null; favoriteUserIds: string[] }> {
  if (!hasDbConfigured) return { role: null, plan: null, favoriteUserIds: [] };
  const [tu, m] = await Promise.all([
    prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId } } }),
    prisma.membership.findFirst({
      // startsAt ≤ now: a renewal for next season is already stored but not the current plan yet
      where: { tenantId, userId, status: "ACTIVE", startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      include: { plan: true },
      orderBy: { startsAt: "desc" },
    }),
  ]);
  const p = m?.plan;
  return {
    role: (tu?.role as TenantRole) ?? null,
    favoriteUserIds: tu?.favoriteUserIds ?? [],
    plan: p ? planFromDb(p) : null,
  };
}

/** Active clubs the user belongs to (for the club switcher). */
export async function getUserClubs(userId: string) {
  if (!process.env.DATABASE_URL) return [];
  const rows = await prisma.tenantUser
    .findMany({ where: { userId, tenant: { status: "ACTIVE" } }, include: { tenant: true } })
    .catch(() => []);
  return rows.map((r) => ({ slug: r.tenant.slug, name: r.tenant.name }));
}
