"use server";

import { auth } from "@/auth";
import { mockDb } from "@/lib/data/mock-db";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { BookingType, BlockReason, BookingParticipant } from "@/types";

export interface CreateBookingInput {
  clubSlug: string;
  courtId: string;
  startsAt: string; // ISO String
  durationMinutes: number; // 60 or 90
  bookingType?: BookingType;
  opponentUserId?: string;
  guestName?: string;
  notes?: string;
}

export async function createBookingAction(input: CreateBookingInput) {
  const session = await auth();
  const tenant = mockDb.getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  // Calculate start & end
  const startDate = new Date(input.startsAt);
  const endDate = new Date(startDate.getTime() + input.durationMinutes * 60 * 1000);

  // Check past time
  if (endDate.getTime() < Date.now() - 5 * 60 * 1000) {
    return { success: false, error: "Zeitslots in der Vergangenheit können nicht gebucht werden." };
  }

  // Determine user
  let organizerId = session?.user?.id;
  const organizerName = session?.user?.name || "Gast";
  const organizerEmail = session?.user?.email || "gast@tennis.ch";

  if (!organizerId) {
    if (!tenant.settingsJson?.allowGuestBookings) {
      return { success: false, error: "Für Buchungen in diesem Club ist eine Anmeldung erforderlich." };
    }
    // Guest booking
    organizerId = `guest-${Date.now()}`;
  }

  // Check overlap with existing bookings on the same court
  const existingBookings = mockDb.getBookings(tenant.id, input.startsAt.split("T")[0]);
  const hasBookingConflict = existingBookings.some((b) => {
    if (b.courtId !== input.courtId || b.status === "CANCELLED") return false;
    const bStart = new Date(b.startsAt).getTime();
    const bEnd = new Date(b.endsAt).getTime();
    return startDate.getTime() < bEnd && endDate.getTime() > bStart;
  });

  if (hasBookingConflict) {
    return { success: false, error: "Dieser Platz ist im gewählten Zeitraum bereits reserviert." };
  }

  // Check overlap with court blocks
  const courtBlocks = mockDb.getCourtBlocks(tenant.id, input.startsAt.split("T")[0]);
  const hasBlockConflict = courtBlocks.some((cb) => {
    if (cb.courtId !== input.courtId) return false;
    const bStart = new Date(cb.startsAt).getTime();
    const bEnd = new Date(cb.endsAt).getTime();
    return startDate.getTime() < bEnd && endDate.getTime() > bStart;
  });

  if (hasBlockConflict) {
    return { success: false, error: "Der Platz ist zu dieser Zeit gesperrt (Wartung/Turnier)." };
  }

  // Prepare participants
  const participants: BookingParticipant[] = [
    {
      id: `part-${Date.now()}-1`,
      bookingId: "",
      userId: organizerId,
      role: "ORGANIZER",
      invitationStatus: "ACCEPTED",
      user: {
        id: organizerId,
        firstName: organizerName.split(" ")[0] || "Spieler",
        lastName: organizerName.split(" ").slice(1).join(" ") || "",
        email: organizerEmail,
      },
    },
  ];

  if (input.opponentUserId) {
    const oppUser = mockDb.getUserById(input.opponentUserId);
    if (oppUser) {
      participants.push({
        id: `part-${Date.now()}-2`,
        bookingId: "",
        userId: oppUser.id,
        role: "PLAYER" as const,
        invitationStatus: "ACCEPTED" as const,
        user: {
          id: oppUser.id,
          firstName: oppUser.firstName,
          lastName: oppUser.lastName,
          email: oppUser.email,
        },
      });
    }
  } else if (input.guestName) {
    participants.push({
      id: `part-${Date.now()}-2`,
      bookingId: "",
      guestName: input.guestName,
      role: "GUEST" as const,
      invitationStatus: "ACCEPTED" as const,
    });
  }

  // Database mode if active
  if (process.env.DATABASE_URL) {
    try {
      await prisma.booking.create({
        data: {
          tenantId: tenant.id,
          courtId: input.courtId,
          organizerId,
          startsAt: startDate,
          endsAt: endDate,
          status: "CONFIRMED",
          bookingType: input.bookingType || "MEMBER",
          notes: input.notes || null,
          createdById: organizerId,
          participants: {
            create: participants.map((p) => ({
              userId: p.userId && !p.userId.startsWith("guest-") ? p.userId : null,
              guestName: p.guestName,
              role: p.role,
              invitationStatus: p.invitationStatus,
            })),
          },
        },
      });
    } catch (e) {
      console.warn("Prisma booking creation failed, falling back to mockDb:", e);
    }
  }

  // Mock store update
  mockDb.createBooking({
    tenantId: tenant.id,
    courtId: input.courtId,
    organizerId,
    startsAt: startDate.toISOString(),
    endsAt: endDate.toISOString(),
    status: "CONFIRMED",
    bookingType: input.bookingType || "MEMBER",
    notes: input.notes || null,
    organizer: {
      id: organizerId,
      firstName: organizerName.split(" ")[0] || "Spieler",
      lastName: organizerName.split(" ").slice(1).join(" ") || "",
      email: organizerEmail,
    },
    participants,
  });

  revalidatePath(`/c/${input.clubSlug}`);
  return { success: true };
}

export async function cancelBookingAction(bookingId: string, clubSlug: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Bitte melde dich an, um eine Buchung zu stornieren." };
  }

  const userId = session.user.id;
  const isPlatformAdmin = Boolean(session.user.isPlatformAdmin || session.user.role === "PLATFORM_ADMIN");
  const isClubAdmin =
    isPlatformAdmin ||
    session.user.role === "CLUB_ADMIN" ||
    session.user.tenants?.some((t) => t.slug === clubSlug && t.role === "CLUB_ADMIN");

  const booking = mockDb.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return { success: false, error: "Buchung nicht gefunden." };
  }

  // Check authorization: organizer or admin
  const isOrganizer = booking.organizerId === userId;
  if (!isOrganizer && !isClubAdmin) {
    return { success: false, error: "Du hast keine Berechtigung, diese Buchung zu stornieren." };
  }

  // Check cancellation deadline (24 hours prior) for non-admins
  if (!isClubAdmin) {
    const bookingTime = new Date(booking.startsAt).getTime();
    const now = Date.now();
    const hoursRemaining = (bookingTime - now) / (1000 * 60 * 60);

    const deadline = mockDb.getTenantBySlug(clubSlug)?.settingsJson?.cancellationDeadlineHours ?? 24;
    if (hoursRemaining < deadline && hoursRemaining > 0) {
      return {
        success: false,
        error: `Stornierungen sind nur bis ${deadline} Stunden vor Spielbeginn möglich.`,
      };
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: userId,
        },
      });
    } catch (e) {
      console.warn("Prisma cancel failed:", e);
    }
  }

  mockDb.cancelBooking(bookingId, userId);
  revalidatePath(`/c/${clubSlug}`);
  return { success: true };
}

export async function createCourtBlockAction(input: {
  clubSlug: string;
  courtId: string;
  startsAt: string;
  endsAt: string;
  reason: BlockReason;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Nicht autorisiert." };
  }

  const tenant = mockDb.getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  mockDb.createCourtBlock({
    tenantId: tenant.id,
    courtId: input.courtId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    reason: input.reason,
    description: input.description,
    createdById: session.user.id,
  });

  revalidatePath(`/c/${input.clubSlug}`);
  revalidatePath(`/c/${input.clubSlug}/admin`);
  return { success: true };
}
