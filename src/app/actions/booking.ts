"use server";

import { auth } from "@/auth";
import { mockDb } from "@/lib/data/mock-db";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { BookingType, BlockReason, BookingParticipant } from "@/types";

export interface CreateBookingParticipantInput {
  type: "MEMBER" | "GUEST";
  userId?: string;
  guestName?: string;
  guestEmail?: string;
}

export interface CreateBookingInput {
  clubSlug: string;
  courtId: string;
  startsAt: string; // ISO String
  durationMinutes: number; // 60, 90, 120
  bookingType?: BookingType;
  matchType?: "SINGLE" | "DOUBLE";
  participants?: CreateBookingParticipantInput[];
  opponentUserId?: string;
  guestName?: string;
  hasBallMachine?: boolean;
  hasLighting?: boolean;
  notes?: string;
}

export async function createBookingAction(input: CreateBookingInput) {
  const session = await auth();
  const tenant = mockDb.getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  const courts = mockDb.getCourtsByTenantId(tenant.id);
  const court = courts.find((c) => c.id === input.courtId);
  if (!court) {
    return { success: false, error: "Tennisplatz nicht gefunden." };
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
  const isPlatformAdmin = Boolean(session?.user?.isPlatformAdmin || session?.user?.role === "PLATFORM_ADMIN");
  const isClubAdmin =
    isPlatformAdmin ||
    session?.user?.tenants?.some((t) => t.slug === input.clubSlug && t.role === "CLUB_ADMIN");

  if (!organizerId) {
    if (!tenant.settingsJson?.allowGuestBookings) {
      return { success: false, error: "Für Buchungen in diesem Club ist eine Anmeldung erforderlich." };
    }
    // Guest booking
    organizerId = `guest-${Date.now()}`;
  }

  // Determine participants list
  const rawParticipants: CreateBookingParticipantInput[] = [];
  if (input.participants && input.participants.length > 0) {
    rawParticipants.push(...input.participants);
  } else if (input.opponentUserId) {
    rawParticipants.push({ type: "MEMBER", userId: input.opponentUserId });
  } else if (input.guestName) {
    rawParticipants.push({ type: "GUEST", guestName: input.guestName });
  }

  const totalPlayersCount = 1 + rawParticipants.length;
  const isDouble = input.matchType === "DOUBLE" || totalPlayersCount >= 4;

  // E.3 Dynamic duration & Consecutive Doubles Rule
  if (input.durationMinutes > 60) {
    if (!isDouble) {
      return {
        success: false,
        error:
          "2-stündige Buchungen sind im Einzel nicht gestattet. Für 2 Stunden am Stück ist ein 4er-Doppel erforderlich.",
      };
    }
    if (totalPlayersCount < 4) {
      return {
        success: false,
        error:
          "Für eine 2-stündige Doppelreservierung müssen mindestens 3 Mitspieler oder Gäste eingetragen werden (insgesamt 4 Spieler).",
      };
    }
    if (tenant.settingsJson?.allowConsecutiveSlotsForDoubles === false) {
      return {
        success: false,
        error: "Dieser Club erlaubt keine 2-stündigen Doppelbuchungen.",
      };
    }
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

  // E.5 Exklusive Ballmaschinen-Prüfung
  if (input.hasBallMachine) {
    const ballMachineCheck = mockDb.isBallMachineAvailable(
      tenant.id,
      input.startsAt,
      endDate.toISOString()
    );
    if (!ballMachineCheck.available) {
      return {
        success: false,
        error: `Die Ballmaschine ist im gewählten Zeitraum bereits auf ${ballMachineCheck.conflictCourtName} reserviert. Pro Club steht zeitgleich nur eine Maschine zur Verfügung.`,
      };
    }
  }

  // E.4 Clubspezifische Buchungsregeln & Cooldowns (z. B. TC Marly-Modell)
  if (!isClubAdmin && !organizerId.startsWith("guest-")) {
    const marlyCheck = mockDb.checkMarlyRule(
      tenant.id,
      organizerId,
      input.startsAt,
      endDate.toISOString(),
      isDouble
    );
    if (!marlyCheck.allowed) {
      return {
        success: false,
        error: marlyCheck.reason || "Buchungsregel verletzt.",
      };
    }
  }

  // E.1 & E.6 Preiskalkulation & Credits Wallet
  const durationHours = input.durationMinutes / 60;
  let courtCost = 0;

  // Differentiate pricing based on court type & membership
  if (court.sportType === "PADEL") {
    // Padel court rate
    courtCost = (tenant.settingsJson?.defaultHourlyRatePadel ?? court.hourlyRate ?? 40) * durationHours;
  } else if (court.isIndoor) {
    // Indoor Halle
    courtCost = (tenant.settingsJson?.defaultHourlyRateHalle ?? court.hourlyRate ?? 45) * durationHours;
  } else {
    // Outdoor tennis: free for club members, paid for guests
    if (organizerId.startsWith("guest-")) {
      courtCost = (tenant.settingsJson?.defaultHourlyRateTennis ?? court.hourlyRate ?? 30) * durationHours;
    } else {
      courtCost = 0; // included in membership
    }
  }

  // Guest players surcharge
  const guestCount = rawParticipants.filter((p) => p.type === "GUEST").length;
  const guestFeePerGuest = tenant.settingsJson?.guestFee ?? 15;
  const guestCost = guestCount * guestFeePerGuest;

  // Ball machine cost
  const ballMachineCost = input.hasBallMachine
    ? (tenant.settingsJson?.ballMachineFee ?? 10) * durationHours
    : 0;

  // Lighting cost
  const lightingCost = input.hasLighting ? (tenant.settingsJson?.floodlightFee ?? 5) : 0;

  const totalCost = courtCost + guestCost + ballMachineCost + lightingCost;

  // Deduct from wallet if registered member
  if (totalCost > 0 && !organizerId.startsWith("guest-")) {
    const wallet = mockDb.getWallet(tenant.id, organizerId);
    if (wallet.balance < totalCost) {
      return {
        success: false,
        error: `Guthaben nicht ausreichend (${wallet.balance.toFixed(2)} CHF verfügbar, ${totalCost.toFixed(2)} CHF benötigt). Bitte lade Test-Credits auf.`,
        needsTopUp: true,
        requiredAmount: totalCost,
        currentBalance: wallet.balance,
      };
    }

    mockDb.deductWallet(
      tenant.id,
      organizerId,
      totalCost,
      `Buchung ${court.name} (${input.durationMinutes} Min, inkl. Extras)`
    );
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

  rawParticipants.forEach((p, idx) => {
    if (p.type === "MEMBER" && p.userId) {
      const oppUser = mockDb.getUserById(p.userId);
      participants.push({
        id: `part-${Date.now()}-${idx + 2}`,
        bookingId: "",
        userId: p.userId,
        role: "PLAYER",
        invitationStatus: "ACCEPTED",
        user: oppUser
          ? {
              id: oppUser.id,
              firstName: oppUser.firstName,
              lastName: oppUser.lastName,
              email: oppUser.email,
            }
          : null,
      });
    } else {
      participants.push({
        id: `part-${Date.now()}-${idx + 2}`,
        bookingId: "",
        guestName: p.guestName || `Gast ${idx + 1}`,
        guestEmail: p.guestEmail || undefined,
        role: "GUEST",
        invitationStatus: "ACCEPTED",
      });
    }
  });

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
          price: totalCost,
          totalCost: totalCost,
          hasBallMachine: Boolean(input.hasBallMachine),
          hasLighting: Boolean(input.hasLighting),
          notes: input.notes || null,
          createdById: organizerId,
          participants: {
            create: participants.map((p) => ({
              userId: p.userId && !p.userId.startsWith("guest-") ? p.userId : null,
              guestName: p.guestName,
              guestEmail: p.guestEmail,
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
    price: totalCost,
    totalCost: totalCost,
    hasBallMachine: Boolean(input.hasBallMachine),
    hasLighting: Boolean(input.hasLighting),
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
  revalidatePath(`/c/${input.clubSlug}/bookings`);
  return { success: true, totalCost };
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

  const bookingTime = new Date(booking.startsAt).getTime();
  const now = Date.now();

  // Prevent retroactive cancellation of past matches
  if (!isClubAdmin && now >= bookingTime) {
    return { success: false, error: "Vergangene oder laufende Spiele können nicht storniert werden." };
  }

  // Check cancellation deadline for non-admins
  if (!isClubAdmin) {
    const hoursRemaining = (bookingTime - now) / (1000 * 60 * 60);
    const deadline = mockDb.getTenantBySlug(clubSlug)?.settingsJson?.cancellationDeadlineHours ?? 24;
    if (hoursRemaining < deadline) {
      return {
        success: false,
        error: `Stornierungen sind nur bis ${deadline} Stunden vor Spielbeginn möglich.`,
      };
    }
  }

  // Refund credits if booking had costs
  const refundAmount = booking.totalCost || booking.price || 0;
  if (refundAmount > 0 && booking.organizerId && !booking.organizerId.startsWith("guest-")) {
    mockDb.refundWallet(
      booking.tenantId,
      booking.organizerId,
      refundAmount,
      `Erstattung nach Stornierung (Buchung ${booking.id})`,
      booking.id
    );
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
  revalidatePath(`/c/${clubSlug}/bookings`);
  return { success: true, refundAmount };
}

export async function topUpWalletAction(input: {
  clubSlug: string;
  amount: number;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Bitte melde dich an, um dein Guthaben aufzuladen." };
  }

  const tenant = mockDb.getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  const wallet = mockDb.topUpWallet(
    tenant.id,
    session.user.id,
    input.amount,
    `1-Klick Dev/Test-Aufladung (+${input.amount} CHF)`
  );

  revalidatePath(`/c/${input.clubSlug}`);
  revalidatePath(`/c/${input.clubSlug}/bookings`);
  return { success: true, balance: wallet.balance };
}

export async function grantAdminCreditsAction(input: {
  clubSlug: string;
  userId: string;
  amount: number;
  reason: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Nicht angemeldet." };
  }

  const isPlatformAdmin = Boolean(session.user.isPlatformAdmin || session.user.role === "PLATFORM_ADMIN");
  const isClubAdmin =
    isPlatformAdmin ||
    session.user.tenants?.some((t) => t.slug === input.clubSlug && t.role === "CLUB_ADMIN");

  if (!isClubAdmin) {
    return { success: false, error: "Nur Club-Administratoren können Credits gutschreiben." };
  }

  const tenant = mockDb.getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  const wallet = mockDb.grantAdminCredits(
    tenant.id,
    input.userId,
    input.amount,
    input.reason
  );

  revalidatePath(`/c/${input.clubSlug}`);
  revalidatePath(`/c/${input.clubSlug}/admin`);
  return { success: true, newBalance: wallet.balance };
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
    return { success: false, error: "Nicht angemeldet." };
  }

  // Enforce Tenant Admin Authorization
  const isPlatformAdmin = Boolean(session.user.isPlatformAdmin || session.user.role === "PLATFORM_ADMIN");
  const isClubAdmin =
    isPlatformAdmin ||
    session.user.tenants?.some((t) => t.slug === input.clubSlug && t.role === "CLUB_ADMIN");

  if (!isClubAdmin) {
    return { success: false, error: "Keine Berechtigung zur Platzsperrung in diesem Club." };
  }

  const tenant = mockDb.getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  const courts = mockDb.getCourtsByTenantId(tenant.id);
  const courtExists = courts.some((c) => c.id === input.courtId);
  if (!courtExists) {
    return { success: false, error: "Der ausgewählte Platz gehört nicht zu diesem Club." };
  }

  if (process.env.DATABASE_URL) {
    try {
      await prisma.courtBlock.create({
        data: {
          tenantId: tenant.id,
          courtId: input.courtId,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          reason: input.reason,
          description: input.description || null,
          createdById: session.user.id,
        },
      });
    } catch (e) {
      console.warn("Prisma court block creation failed:", e);
    }
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
