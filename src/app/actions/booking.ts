"use server";

import { auth } from "@/auth";
import { mockDb } from "@/lib/data/mock-db";
import { getTenantBySlug, getCourtsByTenantId, getCourtBookings, getCourtBlocks } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";
import { computeBookingCost } from "@/lib/pricing";
import { BookingType, BlockReason, BookingParticipant } from "@/types";
import { sendBookingConfirmation } from "@/lib/mail";

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
  // Identity of the person booking, required when there is no session (anonymous guest).
  // Distinct from `guestName` above, which names an invited playing partner, not the organizer.
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
}

export async function createBookingAction(input: CreateBookingInput) {
  const session = await auth();
  const tenant = await getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  const courts = await getCourtsByTenantId(tenant.id);
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
  const isGuest = !session?.user?.id;
  let organizerId: string = session?.user?.id ?? "";
  let organizerName = session?.user?.name || "Gast";
  let organizerEmail = session?.user?.email || "gast@tennis.ch";
  const isPlatformAdmin = Boolean(session?.user?.isPlatformAdmin || session?.user?.role === "PLATFORM_ADMIN");
  const isClubAdmin =
    isPlatformAdmin ||
    session?.user?.tenants?.some((t) => t.slug === input.clubSlug && t.role === "CLUB_ADMIN");

  if (isGuest) {
    if (!tenant.settingsJson?.allowGuestBookings) {
      return { success: false, error: "Für Buchungen in diesem Club ist eine Anmeldung erforderlich." };
    }
    const guestFirstName = input.guestFirstName?.trim();
    const guestLastName = input.guestLastName?.trim();
    const guestEmail = input.guestEmail?.trim().toLowerCase();
    if (!guestFirstName || !guestLastName || !guestEmail) {
      return { success: false, error: "Bitte gib deinen Namen und deine E-Mail-Adresse an." };
    }
    organizerName = `${guestFirstName} ${guestLastName}`;
    organizerEmail = guestEmail;

    if (process.env.DATABASE_URL) {
      // Find-or-create a lightweight guest User (no password) so the booking's required
      // organizer FK is always valid — mirrors the self-service pattern in api/checkout/route.ts.
      // Submitting an email is not proof of ownership: never attach an anonymous booking to
      // an existing real account (one with a passwordHash) — that would let anyone impersonate
      // a known member by typing their email. Only reuse a previously-created guest identity.
      const existingUser = await prisma.user.findUnique({ where: { email: guestEmail } });
      if (existingUser && existingUser.passwordHash) {
        return {
          success: false,
          error: "Diese E-Mail-Adresse gehört zu einem bestehenden Konto. Bitte melde dich an, um zu buchen.",
        };
      }
      const guestUser =
        existingUser ??
        (await prisma.user.create({
          data: { email: guestEmail, firstName: guestFirstName, lastName: guestLastName, passwordHash: null },
        }));
      await prisma.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: guestUser.id } },
        update: {},
        create: { tenantId: tenant.id, userId: guestUser.id, role: "GUEST" },
      });
      organizerId = guestUser.id;
    } else {
      // mockDb-only mode has no real FK to satisfy and no webhook can reach it anyway —
      // keep today's synthetic id, payment enforcement below stays a no-op in this mode.
      organizerId = `guest-${Date.now()}`;
    }
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

  // E.3 Dynamic duration & Consecutive Doubles Rule: 120 min requires a 4-player double
  if (input.durationMinutes > 90) {
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
  // Extract local date string YYYY-MM-DD from startDate
  const localDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
  const existingBookings = await getCourtBookings(tenant.id, localDateStr);
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
  const courtBlocks = await getCourtBlocks(tenant.id, localDateStr);
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
  if (!isClubAdmin && !isGuest) {
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

  // E.1 & E.6 Preiskalkulation (shared with the client preview)
  const { total: totalCost } = computeBookingCost({
    settings: tenant.settingsJson,
    court,
    isGuest,
    durationMinutes: input.durationMinutes,
    guestCount: rawParticipants.filter((p) => p.type === "GUEST").length,
    hasBallMachine: Boolean(input.hasBallMachine),
    hasLighting: Boolean(input.hasLighting),
  });

  // Guests must pay via Stripe before the booking is confirmed. Postgres-only: a Stripe
  // webhook can never reach the in-memory mockDb, so that mode keeps the previous
  // instant-confirm behavior (member wallet deduction is a separate, pre-existing gap,
  // not touched here).
  const needsPayment = isGuest && totalCost > 0 && Boolean(process.env.DATABASE_URL);

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
  let prismaSuccess = false;
  let createdBookingId: string | null = null;
  if (process.env.DATABASE_URL) {
    try {
      const created = await prisma.booking.create({
        data: {
          tenantId: tenant.id,
          courtId: input.courtId,
          organizerId,
          startsAt: startDate,
          endsAt: endDate,
          status: needsPayment ? "PENDING" : "CONFIRMED",
          bookingType: isGuest ? "GUEST" : input.bookingType || "MEMBER",
          price: totalCost,
          totalCost: totalCost,
          hasBallMachine: Boolean(input.hasBallMachine),
          hasLighting: Boolean(input.hasLighting),
          notes: input.notes || null,
          createdById: organizerId,
          participants: {
            create: participants.map((p) => ({
              userId: p.userId || null,
              guestName: p.guestName,
              guestEmail: p.guestEmail,
              role: p.role,
              invitationStatus: p.invitationStatus,
            })),
          },
        },
      });
      prismaSuccess = true;
      createdBookingId = created.id;
    } catch (e) {
      if (process.env.NODE_ENV === "production") throw e;
      console.warn("Prisma booking creation failed, falling back to mockDb:", e);
    }
  }

  // Mock store update
  if (!prismaSuccess) {
    mockDb.createBooking({
      tenantId: tenant.id,
      courtId: input.courtId,
      organizerId,
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
      status: "CONFIRMED",
      bookingType: isGuest ? "GUEST" : input.bookingType || "MEMBER",
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
  }

  revalidatePath(`/c/${input.clubSlug}`, "layout");
  revalidatePath(`/c/${input.clubSlug}/bookings`);

  if (needsPayment && prismaSuccess && createdBookingId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      const stripe = getStripe();
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: organizerEmail,
        line_items: [
          {
            price_data: {
              currency: "chf",
              product_data: {
                name: `Platzbuchung: ${court.name}`,
                description: `${tenant.name}, ${startDate.toLocaleString("de-CH")}`,
              },
              unit_amount: Math.round(totalCost * 100),
            },
            quantity: 1,
          },
        ],
        metadata: { bookingId: createdBookingId, tenantId: tenant.id },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${appUrl}/c/${input.clubSlug}?bookingConfirmed=1`,
        cancel_url: `${appUrl}/c/${input.clubSlug}?bookingCancelled=1`,
      });
      await prisma.booking.update({
        where: { id: createdBookingId },
        data: { stripeSessionId: checkoutSession.id },
      });
      return { success: true, totalCost, checkoutUrl: checkoutSession.url };
    } catch (e) {
      console.error("Stripe checkout session creation failed:", e);
      // The PENDING booking can't be paid for via this response — release the slot
      // instead of leaving it blocked forever.
      await prisma.booking
        .update({ where: { id: createdBookingId }, data: { status: "CANCELLED", cancelledAt: new Date() } })
        .catch(() => {});
      return { success: false, error: "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut." };
    }
  }

  if (prismaSuccess && createdBookingId) await sendBookingConfirmation(createdBookingId);
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

  const cancelTenant = await getTenantBySlug(clubSlug);
  if (!cancelTenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  const dbBooking = process.env.DATABASE_URL
    ? await prisma.booking.findUnique({ where: { id: bookingId } }).catch(() => null)
    : null;
  const booking = dbBooking
    ? {
        id: dbBooking.id,
        tenantId: dbBooking.tenantId,
        organizerId: dbBooking.organizerId,
        bookingType: dbBooking.bookingType,
        startsAt: dbBooking.startsAt.toISOString(),
        totalCost: Number(dbBooking.totalCost),
        price: Number(dbBooking.price),
      }
    : mockDb.bookings.find((b) => b.id === bookingId);
  // Scope strictly to the club the caller is acting in — a booking id from another
  // tenant must never be actionable just because the caller is an admin somewhere.
  if (!booking || booking.tenantId !== cancelTenant.id) {
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
    const deadline = cancelTenant.settingsJson?.cancellationDeadlineHours ?? 24;
    if (hoursRemaining < deadline) {
      return {
        success: false,
        error: `Stornierungen sind nur bis ${deadline} Stunden vor Spielbeginn möglich.`,
      };
    }
  }

  // Refund credits if booking had costs — guests paid via Stripe, not the app wallet,
  // so they're excluded here (their money already went through checkout, not a wallet).
  const refundAmount = booking.totalCost || booking.price || 0;
  if (refundAmount > 0 && booking.organizerId && booking.bookingType !== "GUEST") {
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
  revalidatePath(`/c/${clubSlug}`, "layout");
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

  revalidatePath(`/c/${input.clubSlug}`, "layout");
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

  revalidatePath(`/c/${input.clubSlug}`, "layout");
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

  const tenant = await getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  const courts = await getCourtsByTenantId(tenant.id);
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

  revalidatePath(`/c/${input.clubSlug}`, "layout");
  revalidatePath(`/c/${input.clubSlug}/admin`);
  return { success: true };
}

export async function deleteCourtBlockAction(input: { clubSlug: string; blockId: string }) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Nicht angemeldet." };
  }

  const isPlatformAdmin = Boolean(session.user.isPlatformAdmin || session.user.role === "PLATFORM_ADMIN");
  const isClubAdmin =
    isPlatformAdmin ||
    session.user.tenants?.some((t) => t.slug === input.clubSlug && t.role === "CLUB_ADMIN");
  if (!isClubAdmin) {
    return { success: false, error: "Keine Berechtigung in diesem Club." };
  }

  const tenant = await getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  if (process.env.DATABASE_URL) {
    try {
      // tenantId in the filter keeps an admin from deleting another club's block
      await prisma.courtBlock.deleteMany({ where: { id: input.blockId, tenantId: tenant.id } });
    } catch (e) {
      console.warn("Prisma court block deletion failed:", e);
    }
  }
  const mockBlock = mockDb.courtBlocks.find((b) => b.id === input.blockId);
  if (mockBlock?.tenantId === tenant.id) mockDb.deleteCourtBlock(input.blockId);

  revalidatePath(`/c/${input.clubSlug}`, "layout");
  return { success: true };
}
