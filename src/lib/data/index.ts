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
