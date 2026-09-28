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
      console.warn("Prisma query failed, falling back to mockDb:", e);
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
      console.warn("Prisma query failed, falling back to mockDb:", e);
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
      console.warn("Prisma query failed, falling back to mockDb:", e);
    }
  }
  return mockDb.getCourtsByTenantId(tenantId);
}

export async function getCourtBookings(
  tenantId: string,
  dateStr: string // YYYY-MM-DD
): Promise<Booking[]> {
  if (hasDbConfigured) {
    try {
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

      const dbBookings = await prisma.booking.findMany({
        where: {
          tenantId,
          startsAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            not: "CANCELLED",
          },
        },
        include: {
          organizer: true,
          participants: {
            include: {
              user: true,
            },
          },
        },
      });

      const prismaMapped: Booking[] = dbBookings.map((b) => ({
        id: b.id,
        tenantId: b.tenantId,
        courtId: b.courtId,
        organizerId: b.organizerId,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        status: b.status as BookingStatus,
        bookingType: b.bookingType as BookingType,
        notes: b.notes || null,
        hasBallMachine: Boolean((b as { hasBallMachine?: boolean }).hasBallMachine),
        hasLighting: Boolean((b as { hasLighting?: boolean }).hasLighting),
        totalCost: Number((b as { totalCost?: unknown }).totalCost || 0),
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
      }));
      
      const mockBookings = mockDb.getBookings(tenantId, dateStr);
      const merged = [...prismaMapped];
      for (const mb of mockBookings) {
        if (!merged.some(pb => pb.id === mb.id)) {
          merged.push(mb);
        }
      }
      return merged;
    } catch (e) {
      console.warn("Prisma query failed, falling back to mockDb:", e);
    }
  }
  return mockDb.getBookings(tenantId, dateStr);
}

export async function getCourtBlocks(
  tenantId: string,
  dateStr: string
): Promise<CourtBlock[]> {
  if (hasDbConfigured) {
    try {
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

      const blocks = await prisma.courtBlock.findMany({
        where: {
          tenantId,
          startsAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      if (blocks.length > 0) {
        const prismaMapped: CourtBlock[] = blocks.map((b) => ({
          id: b.id,
          tenantId: b.tenantId,
          courtId: b.courtId,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          reason: b.reason as BlockReason,
          description: b.description || null,
          createdById: b.createdById,
        }));
        
        const mockBlocks = mockDb.getCourtBlocks(tenantId, dateStr);
        const merged = [...prismaMapped];
        for (const mb of mockBlocks) {
          if (!merged.some(pb => pb.id === mb.id)) {
            merged.push(mb);
          }
        }
        return merged;
      }
    } catch (e) {
      console.warn("Prisma query failed, falling back to mockDb:", e);
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
      console.warn("Prisma query failed, falling back to mockDb:", e);
    }
  }
  return mockDb.getUsersByTenantId(tenantId);
}

export async function getUserBookings(userId: string): Promise<Booking[]> {
  return mockDb.getAllUserBookings(userId);
}

export async function getMembershipPlansByTenantId(tenantId: string): Promise<MembershipPlan[]> {
  if (hasDbConfigured) {
    try {
      const plans = await prisma.membershipPlan.findMany({
        where: { tenantId, status: "ACTIVE" },
        orderBy: { price: "asc" },
      });
      if (plans.length > 0) {
        return plans.map((p) => ({
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
        }));
      }
    } catch (e) {
      console.warn("Prisma query failed, falling back to mockDb:", e);
    }
  }
  return mockDb.getMembershipPlans(tenantId);
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
            settingsJson: mergedSettings,
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
      console.warn("Prisma updateTenantSettings failed, falling back to mockDb:", e);
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
          status: "ACTIVE",
        },
      });
      return {
        id: dbPlan.id,
        tenantId: dbPlan.tenantId,
        name: dbPlan.name,
        description: dbPlan.description,
        price: Number(dbPlan.price),
        currency: dbPlan.currency,
        bookingWindowDays: dbPlan.bookingWindowDays,
        simultaneousBookingLimit: dbPlan.simultaneousBookingLimit,
        dailyBookingLimit: dbPlan.dailyBookingLimit,
        weeklyBookingLimit: dbPlan.weeklyBookingLimit,
        allowedDurations: dbPlan.allowedDurations,
      };
    } catch (e) {
      console.warn("Prisma createMembershipPlan failed, falling back to mockDb:", e);
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
        },
      });
      return {
        id: dbPlan.id,
        tenantId: dbPlan.tenantId,
        name: dbPlan.name,
        description: dbPlan.description,
        price: Number(dbPlan.price),
        currency: dbPlan.currency,
        bookingWindowDays: dbPlan.bookingWindowDays,
        simultaneousBookingLimit: dbPlan.simultaneousBookingLimit,
        dailyBookingLimit: dbPlan.dailyBookingLimit,
        weeklyBookingLimit: dbPlan.weeklyBookingLimit,
        allowedDurations: dbPlan.allowedDurations,
      };
    } catch (e) {
      console.warn("Prisma updateMembershipPlan failed, falling back to mockDb:", e);
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
      console.warn("Prisma deleteMembershipPlan failed, falling back to mockDb:", e);
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
    } catch (e) {
      console.warn("Prisma getUserWallet failed, falling back to mockDb:", e);
    }
  }
  if (typeof mockDb.getWallet === "function") {
    return mockDb.getWallet(tenantId, userId);
  }
  return {
    id: `wallet-${tenantId}-${userId}`,
    tenantId,
    userId,
    balance: 50,
    currency: "CHF",
    transactions: [],
  };
}

export async function topUpUserWallet(
  tenantId: string,
  userId: string,
  amount: number,
  description?: string
): Promise<UserWallet> {
  const mockRes =
    typeof mockDb.topUpWallet === "function"
      ? mockDb.topUpWallet(tenantId, userId, amount, description)
      : {
          id: `wallet-${tenantId}-${userId}`,
          tenantId,
          userId,
          balance: 50 + amount,
          currency: "CHF",
          transactions: [],
        };
  if (hasDbConfigured) {
    try {
      const updated = await prisma.userWallet.upsert({
        where: {
          tenantId_userId: { tenantId, userId },
        },
        create: {
          tenantId,
          userId,
          balance: 50 + amount,
          currency: "CHF",
          transactions: {
            create: {
              amount,
              type: "TOP_UP",
              description: description || `Guthaben aufgeladen (+${amount} CHF)`,
            },
          },
        },
        update: {
          balance: { increment: amount },
          transactions: {
            create: {
              amount,
              type: "TOP_UP",
              description: description || `Guthaben aufgeladen (+${amount} CHF)`,
            },
          },
        },
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });
      return {
        id: updated.id,
        tenantId: updated.tenantId,
        userId: updated.userId,
        balance: Number(updated.balance),
        currency: updated.currency,
        transactions: updated.transactions.map((tx) => ({
          id: tx.id,
          walletId: tx.walletId,
          amount: Number(tx.amount),
          type: tx.type,
          description: tx.description,
          bookingId: tx.bookingId,
          createdAt: tx.createdAt.toISOString(),
        })),
      };
    } catch (e) {
      console.warn("Prisma topUpUserWallet failed, falling back to mockDb:", e);
    }
  }
  return mockRes;
}

export async function grantAdminCredits(
  tenantId: string,
  userId: string,
  amount: number,
  reason: string
): Promise<UserWallet> {
  const mockRes =
    typeof mockDb.grantAdminCredits === "function"
      ? mockDb.grantAdminCredits(tenantId, userId, amount, reason)
      : {
          id: `wallet-${tenantId}-${userId}`,
          tenantId,
          userId,
          balance: 50 + amount,
          currency: "CHF",
          transactions: [],
        };
  if (hasDbConfigured) {
    try {
      await prisma.userWallet.upsert({
        where: {
          tenantId_userId: { tenantId, userId },
        },
        create: {
          tenantId,
          userId,
          balance: 50 + amount,
          transactions: {
            create: {
              amount,
              type: "ADMIN_GRANT",
              description: `Admin-Gutschrift: ${reason} (+${amount} CHF)`,
            },
          },
        },
        update: {
          balance: { increment: amount },
          transactions: {
            create: {
              amount,
              type: "ADMIN_GRANT",
              description: `Admin-Gutschrift: ${reason} (+${amount} CHF)`,
            },
          },
        },
      });
    } catch (e) {
      console.warn("Prisma grantAdminCredits failed, falling back to mockDb:", e);
    }
  }
  return mockRes;
}

export async function checkBallMachineAvailability(
  tenantId: string,
  startsAt: string,
  endsAt: string,
  excludeBookingId?: string
): Promise<{ available: boolean; conflictCourtName?: string }> {
  if (typeof mockDb.isBallMachineAvailable === "function") {
    return mockDb.isBallMachineAvailable(tenantId, startsAt, endsAt, excludeBookingId);
  }
  return { available: true };
}

