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
          surface: c.surface as CourtSurface,
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

      if (dbBookings.length > 0) {
        return dbBookings.map((b) => ({
          id: b.id,
          tenantId: b.tenantId,
          courtId: b.courtId,
          organizerId: b.organizerId,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          status: b.status as BookingStatus,
          bookingType: b.bookingType as BookingType,
          notes: b.notes,
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
      }
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
        return blocks.map((b) => ({
          id: b.id,
          tenantId: b.tenantId,
          courtId: b.courtId,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          reason: b.reason as BlockReason,
          description: b.description,
          createdById: b.createdById,
        }));
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
          description: p.description,
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
