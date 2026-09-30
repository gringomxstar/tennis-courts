"use server";

import { auth } from "@/auth";
import { mockDb } from "@/lib/data/mock-db";
import {
  getTenantBySlug,
  getCourtsByTenantId,
  getBookingsInRange,
  getBlocksInRange,
  getMemberContext,
  getUserBookings,
  activePlanSports,
} from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";
import { computeBookingCost, needsFloodlight, settleBooking } from "@/lib/pricing";
import { BlockReason, BookingParticipant, PaymentMethod, SportType, TenantSettings } from "@/types";
import { sendBookingCancellation, sendBookingConfirmation, sendMail } from "@/lib/mail";
import { ballMachineConflict, cancelDeadlineMinutes, checkBookingRules, deadlineText, lateBookingCutoff, weeklyStarts } from "@/lib/booking-rules";
import { randomUUID } from "node:crypto";
import { logMoney } from "@/lib/audit";
import { InsufficientFundsError, debitWallets, refundBookingWallets } from "@/lib/wallet";
import { refundStripeBooking } from "@/lib/booking-payment";
import { bookingLink, verifyBookingToken } from "@/lib/booking-link";

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
  matchType?: "SINGLE" | "DOUBLE";
  participants?: CreateBookingParticipantInput[];
  opponentUserId?: string;
  guestName?: string;
  hasBallMachine?: boolean;
  notes?: string;
  // Identity of the person booking, required when there is no session (anonymous guest).
  // Distinct from `guestName` above, which names an invited playing partner, not the organizer.
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  /** Only ON_SITE / INVOICE (when the club enabled them) are honoured; anything else follows settleBooking. */
  paymentMethod?: PaymentMethod;
  /** Split the price evenly across the organizer and all member participants' wallets. */
}

const HOUR = 3_600_000;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function isClubAdminFor(
  user: { isPlatformAdmin?: boolean; role?: string; tenants?: { slug: string; role: string }[] } | undefined,
  clubSlug: string
) {
  if (!user) return false;
  return Boolean(
    user.isPlatformAdmin ||
      user.role === "PLATFORM_ADMIN" ||
      user.tenants?.some((t) => t.slug === clubSlug && t.role === "CLUB_ADMIN")
  );
}

async function createCheckout(o: {
  email: string;
  amount: number;
  name: string;
  description: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}) {
  return getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: o.email,
    line_items: [
      {
        price_data: {
          currency: "chf",
          product_data: { name: o.name, description: o.description },
          unit_amount: Math.round(o.amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: o.metadata,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: o.successUrl,
    cancel_url: o.cancelUrl,
  });
}

export async function createBookingAction(input: CreateBookingInput) {
  const session = await auth();
  const tenant = await getTenantBySlug(input.clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }
  const settings = tenant.settingsJson;
  const hasDb = Boolean(process.env.DATABASE_URL);

  const courts = await getCourtsByTenantId(tenant.id);
  const court = courts.find((c) => c.id === input.courtId);
  if (!court || court.status !== "ACTIVE") {
    return { success: false, error: "Tennisplatz nicht gefunden." };
  }

  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 30 || input.durationMinutes > 120) {
    return { success: false, error: "Ungültige Spieldauer." };
  }
  const startDate = new Date(input.startsAt);
  const endDate = new Date(startDate.getTime() + input.durationMinutes * 60 * 1000);
  if (Number.isNaN(startDate.getTime())) {
    return { success: false, error: "Ungültige Startzeit." };
  }
  if (startDate.getTime() < lateBookingCutoff(settings)) {
    return { success: false, error: "Dieser Zeitslot hat bereits begonnen und kann nicht mehr gebucht werden." };
  }

  // Determine user
  const isGuest = !session?.user?.id;
  let organizerId: string = session?.user?.id ?? "";
  let organizerName = session?.user?.name || "Gast";
  let organizerEmail = session?.user?.email || "gast@tennis.ch";
  const isClubAdmin = isClubAdminFor(session?.user, input.clubSlug);

  if (isGuest) {
    if (!settings?.allowGuestBookings) {
      return { success: false, error: "Für Buchungen in diesem Club ist eine Anmeldung erforderlich." };
    }
    const guestFirstName = input.guestFirstName?.trim();
    const guestLastName = input.guestLastName?.trim() ?? "";
    const guestEmail = input.guestEmail?.trim().toLowerCase();
    if (!guestFirstName || !guestEmail || !/^\S+@\S+\.\S+$/.test(guestEmail)) {
      return { success: false, error: "Bitte gib deinen Namen und eine gültige E-Mail-Adresse an." };
    }
    organizerName = `${guestFirstName} ${guestLastName}`.trim();
    organizerEmail = guestEmail;

    if (hasDb) {
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
      // ponytail: per-email cap only; a script with random emails needs a Vercel Firewall rate-limit rule on this route
      if ((await prisma.booking.count({ where: { organizerId: guestUser.id, status: "PENDING", createdAt: { gt: new Date(Date.now() - 35 * 60_000) } } })) >= 3) {
        return { success: false, error: "Du hast schon mehrere Buchungen, die auf Zahlung warten. Bitte schliesse zuerst eine ab." };
      }
      await prisma.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: guestUser.id } },
        update: {},
        create: { tenantId: tenant.id, userId: guestUser.id, role: "GUEST" },
      });
      organizerId = guestUser.id;
    } else {
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
  const maxPartners = input.matchType === "DOUBLE" ? 5 : 3;
  if (rawParticipants.length > maxPartners) {
    return { success: false, error: `Maximal ${maxPartners} Mitspieler pro Buchung.` };
  }
  const memberIds = [
    ...new Set(rawParticipants.filter((p) => p.type === "MEMBER" && p.userId).map((p) => p.userId!)),
  ].filter((id) => id !== organizerId);
  if (hasDb && memberIds.length) {
    const known = await prisma.tenantUser.count({ where: { tenantId: tenant.id, userId: { in: memberIds } } });
    if (known !== memberIds.length) {
      return { success: false, error: "Mindestens ein Mitspieler ist kein Mitglied dieses Clubs." };
    }
  }
  const guestCount = rawParticipants.filter((p) => p.type === "GUEST").length;

  const totalPlayersCount = 1 + rawParticipants.length;
  const isDouble = input.matchType === "DOUBLE" || totalPlayersCount >= 4;
  if (input.matchType === "DOUBLE" && totalPlayersCount < 4) {
    return { success: false, error: "Für ein Doppel braucht es 4 Spieler: wähle 3 Mitspieler oder Gäste." };
  }

  const member = isGuest ? null : await getMemberContext(tenant.id, organizerId);
  // Dynamic duration & Consecutive Doubles Rule: 120 min requires a 4-player double (not for training)
  if (input.durationMinutes > 90 && member?.role !== "COACH") {
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
    if (settings?.allowConsecutiveSlotsForDoubles === false) {
      return { success: false, error: "Dieser Club erlaubt keine 2-stündigen Doppelbuchungen." };
    }
  }

  // Court, block and ball-machine conflicts — bookings are at most 2h, so 3h lookback covers overlaps
  const overlaps = (b: { startsAt: string; endsAt: string }) =>
    startDate.getTime() < new Date(b.endsAt).getTime() && endDate.getTime() > new Date(b.startsAt).getTime();
  const [nearby, blocks] = await Promise.all([
    getBookingsInRange(tenant.id, new Date(startDate.getTime() - 3 * HOUR).toISOString(), endDate.toISOString()),
    getBlocksInRange(tenant.id, startDate.toISOString(), endDate.toISOString()),
  ]);
  if (nearby.some((b) => b.courtId === input.courtId && overlaps(b))) {
    return { success: false, error: "Dieser Platz ist im gewählten Zeitraum bereits reserviert." };
  }
  if (blocks.some((b) => b.courtId === input.courtId && overlaps(b))) {
    return { success: false, error: "Der Platz ist zu dieser Zeit gesperrt (Wartung/Turnier)." };
  }
  if (input.hasBallMachine) {
    if (settings?.ballMachineAvailable === false) {
      return { success: false, error: "Dieser Club bietet keine Ballmaschine an." };
    }
    const conflict = ballMachineConflict(nearby, startDate, endDate);
    if (conflict) {
      const where = courts.find((c) => c.id === conflict.courtId)?.name || "einem anderen Platz";
      return {
        success: false,
        error: `Die Ballmaschine ist im gewählten Zeitraum bereits auf ${where} reserviert. Pro Club steht zeitgleich nur eine Maschine zur Verfügung.`,
      };
    }
  }

  // Club rules, role/sport limits and membership-plan rules (against the real bookings)
  if (member && !isClubAdmin) {
    const mine = await getUserBookings(organizerId, tenant.id);
    const sportOf = new Map(courts.map((c) => [c.id, c.sportType]));
    const sessionRole = session?.user?.tenants?.find((t) => t.slug === input.clubSlug)?.role;
    const error = checkBookingRules({
      settings,
      role: member.role ?? sessionRole ?? "GUEST",
      plan: member.plan,
      sport: court.sportType,
      start: startDate,
      end: endDate,
      isDouble,
      guestCount,
      mine: mine.map((b) => ({
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        sport: sportOf.get(b.courtId) ?? "TENNIS",
        guestCount: b.organizerId === organizerId ? b.participants.filter((p) => p.role === "GUEST").length : 0,
      })),
    });
    if (error) return { success: false, error };
    // coaches book training slots alone; everyone else names who they play with
    if (member.role !== "COACH" && rawParticipants.length === 0) {
      return { success: false, error: "Bitte wähle mindestens einen Mitspieler oder Gast." };
    }
  }

  // never trust the browser for the floodlight fee
  const hasLighting = needsFloodlight(court, startDate, input.durationMinutes);
  // everyone on the court: an Abo covers its holder's share, the booker pays the rest
  const aboOf = hasDb && memberIds.length ? await activePlanSports(tenant.id, memberIds) : new Map<string, SportType[]>();
  const { total: totalCost } = computeBookingCost({
    settings,
    court,
    players: [member?.plan?.sports ?? null, ...memberIds.map((id) => aboOf.get(id) ?? null), ...Array<null>(guestCount).fill(null)],
    durationMinutes: input.durationMinutes,
    hasBallMachine: Boolean(input.hasBallMachine),
    hasLighting,
    start: startDate,
  });

  // Payment method. Only the club's extra methods (vor Ort, Rechnung) are a choice; otherwise the owner's
  // rule decides on the server: wallet when it covers the total, else the full amount via Stripe.
  let method: PaymentMethod | null = null;
  if (totalCost > 0 && hasDb) {
    const want = input.paymentMethod;
    if (want === "ON_SITE" && settings?.payOnSite) method = "ON_SITE";
    else if (want === "INVOICE" && settings?.payByInvoice && !isGuest) method = "INVOICE";
    else if (isGuest) method = "ONLINE";
    else {
      const w = await prisma.userWallet.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: organizerId } } });
      method = settleBooking(Number(w?.balance ?? 0), totalCost).method;
    }
  }

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
      participants.push({
        id: `part-${Date.now()}-${idx + 2}`,
        bookingId: "",
        userId: p.userId,
        role: "PLAYER",
        invitationStatus: "ACCEPTED",
      });
    } else {
      participants.push({
        id: `part-${Date.now()}-${idx + 2}`,
        bookingId: "",
        guestName: p.guestName?.trim() || `Gast ${idx + 1}`,
        guestEmail: p.guestEmail?.trim().toLowerCase() || undefined,
        role: "GUEST",
        invitationStatus: "ACCEPTED",
      });
    }
  });

  if (!hasDb) {
    // dev-only in-memory mode: no payments
    mockDb.createBooking({
      tenantId: tenant.id,
      courtId: input.courtId,
      organizerId,
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
      status: "CONFIRMED",
      bookingType: isGuest ? "GUEST" : member?.role === "COACH" ? "COACH" : "MEMBER",
      price: totalCost,
      totalCost,
      hasBallMachine: Boolean(input.hasBallMachine),
      hasLighting,
      notes: input.notes || null,
      organizer: participants[0].user!,
      participants,
    });
    revalidatePath(`/c/${input.clubSlug}`, "layout");
    return { success: true, totalCost };
  }

  const bookingData = (m: PaymentMethod | null) => ({
    tenantId: tenant.id,
    courtId: input.courtId,
    organizerId,
    startsAt: startDate,
    endsAt: endDate,
    status: m === "ONLINE" ? ("PENDING" as const) : ("CONFIRMED" as const),
    paymentStatus: !m ? ("WAIVED" as const) : m === "WALLET" ? ("PAID" as const) : ("UNPAID" as const),
    paymentMethod: m,
    bookingType: isGuest ? ("GUEST" as const) : member?.role === "COACH" ? ("COACH" as const) : ("MEMBER" as const),
    price: totalCost,
    totalCost,
    hasBallMachine: Boolean(input.hasBallMachine),
    hasLighting,
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
  });

  let created: { id: string };
  try {
    if (method === "WALLET") {
      // only the booker pays; co-players are never charged
      const charges = [{ userId: organizerId, amount: totalCost }];
      try {
        created = await prisma.$transaction(async (tx) => {
          const b = await tx.booking.create({ data: bookingData("WALLET") });
          await debitWallets(tx, tenant.id, charges, b.id, `Platzbuchung ${court.name}, ${startDate.toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}`);
          return b;
        });
      } catch (e) {
        if (!(e instanceof InsufficientFundsError)) throw e;
        method = "ONLINE"; // balance changed since the check (concurrent booking): pay online instead
        created = await prisma.booking.create({ data: bookingData(method) });
      }
    } else {
      created = await prisma.booking.create({ data: bookingData(method) });
    }
  } catch (e) {
    // the DB exclusion constraint catches a double booking that raced past the check above
    console.error("Booking creation failed:", e);
    return { success: false, error: "Buchung fehlgeschlagen. Der Platz wurde eventuell gerade vergeben." };
  }

  revalidatePath(`/c/${input.clubSlug}`, "layout");

  if (method === "ONLINE") {
    try {
      const checkout = await createCheckout({
        email: organizerEmail,
        amount: totalCost,
        name: `Platzbuchung: ${court.name}`,
        description: `${tenant.name}, ${startDate.toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}`,
        metadata: { bookingId: created.id, tenantId: tenant.id },
        successUrl: isGuest ? `${bookingLink(input.clubSlug, created.id)}&paid=1` : `${appUrl()}/c/${input.clubSlug}/bookings?bookingConfirmed=1`,
        cancelUrl: `${bookingLink(input.clubSlug, created.id)}&abgebrochen=1`,
      });
      await prisma.booking.update({ where: { id: created.id }, data: { stripeSessionId: checkout.id } });
      return { success: true, totalCost, checkoutUrl: checkout.url };
    } catch (e) {
      console.error("Stripe checkout session creation failed:", e);
      // The PENDING booking can't be paid for via this response — release the slot
      await prisma.booking
        .update({ where: { id: created.id }, data: { status: "CANCELLED", cancelledAt: new Date() } })
        .catch(() => {});
      return { success: false, error: "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut." };
    }
  }

  await sendBookingConfirmation(created.id);
  return {
    success: true,
    totalCost,
    paymentMethod: method,
    ...(isGuest ? { manageUrl: bookingLink(input.clubSlug, created.id) } : {}),
  };
}

// ponytail: a series is tagged via idempotencyKey "series:<id>:<n>" instead of a schema column; add Booking.seriesId if series need more than cancel-all
const SERIES = "series:";
const KURS = "kurs:";
const HEX = /^[0-9a-f]{6}$/i;
// Kursfarbe steckt als 4. Teil im Key (kurs:<id>:<n>:<hex>), keine Migration. ponytail: echtes Feld bei Bedarf.
const seriesOf = (key: string | null | undefined) => (key?.startsWith(SERIES) || key?.startsWith(KURS) ? key.split(":")[1] : undefined);

/**
 * Trainer: the same court and hour every week until `until`. Weeks that are taken or blocked are
 * skipped and reported. No member limits; the court fee goes on the club invoice.
 */
export async function createCoachSeriesAction(input: {
  clubSlug: string;
  courtId: string;
  startsAt: string;
  durationMinutes: number;
  until: string;
}) {
  const session = await auth();
  const tenant = await getTenantBySlug(input.clubSlug);
  if (!session?.user?.id || !tenant || !process.env.DATABASE_URL) return { success: false as const, error: "Bitte melde dich an." };
  const userId = session.user.id;
  const member = await getMemberContext(tenant.id, userId);
  if (member?.role !== "COACH" && !isClubAdminFor(session.user, input.clubSlug)) {
    return { success: false as const, error: "Serienbuchungen sind Trainern vorbehalten." };
  }
  const court = (await getCourtsByTenantId(tenant.id)).find((c) => c.id === input.courtId);
  if (!court || court.status !== "ACTIVE") return { success: false as const, error: "Tennisplatz nicht gefunden." };
  const start = new Date(input.startsAt);
  const until = new Date(input.until);
  const minutes = input.durationMinutes;
  if (Number.isNaN(start.getTime()) || Number.isNaN(until.getTime()) || until <= start) {
    return { success: false as const, error: "Ungültiger Zeitraum." };
  }
  if (![60, 90, 120].includes(minutes)) return { success: false as const, error: "Ungültige Spieldauer." };
  if (start.getTime() < lateBookingCutoff(tenant.settingsJson)) {
    return { success: false as const, error: "Dieser Zeitslot hat bereits begonnen." };
  }

  const starts = weeklyStarts(start, until);
  const last = starts[starts.length - 1];
  const [taken, blocks] = await Promise.all([
    getBookingsInRange(tenant.id, new Date(start.getTime() - 3 * HOUR).toISOString(), new Date(last.getTime() + minutes * 60_000).toISOString()),
    getBlocksInRange(tenant.id, start.toISOString(), new Date(last.getTime() + minutes * 60_000).toISOString()),
  ]);
  const hit = (s: Date, e: Date) => (b: { courtId: string; startsAt: string; endsAt: string }) =>
    b.courtId === court.id && s.getTime() < new Date(b.endsAt).getTime() && e.getTime() > new Date(b.startsAt).getTime();
  const free: Date[] = [];
  const skipped: string[] = [];
  for (const s of starts) {
    const e = new Date(s.getTime() + minutes * 60_000);
    if (taken.some(hit(s, e)) || blocks.some(hit(s, e))) skipped.push(s.toISOString());
    else free.push(s);
  }
  if (!free.length) return { success: false as const, error: "In diesem Zeitraum ist der Platz zu dieser Zeit nie frei." };

  const seriesId = randomUUID().slice(0, 8);
  const rows = free.map((s, n) => {
    const e = new Date(s.getTime() + minutes * 60_000);
    const light = needsFloodlight(court, s, minutes);
    const { total } = computeBookingCost({
      settings: tenant.settingsJson,
      court,
      // everybody needs an Abo, trainers too; an admin can mark the invoice paid or waived (logged)
      players: [member?.plan?.sports ?? null],
      durationMinutes: minutes,
      hasBallMachine: false,
      hasLighting: light,
      start: s,
    });
    return prisma.booking.create({
      data: {
        tenantId: tenant.id,
        courtId: court.id,
        organizerId: userId,
        createdById: userId,
        startsAt: s,
        endsAt: e,
        bookingType: "COACH",
        hasLighting: light,
        price: total,
        totalCost: total,
        paymentMethod: total > 0 ? "INVOICE" : null,
        paymentStatus: total > 0 ? "UNPAID" : "WAIVED",
        idempotencyKey: `${SERIES}${seriesId}:${n}`,
        notes: "Training (Serie)",
        participants: { create: [{ userId, role: "COACH", invitationStatus: "ACCEPTED" }] },
      },
    });
  });
  try {
    await prisma.$transaction(rows);
  } catch (e) {
    // the exclusion constraint caught a booking made in the meantime
    console.error("Series creation failed:", e);
    return { success: false as const, error: "Serie fehlgeschlagen. Ein Termin wurde eventuell gerade vergeben, bitte erneut versuchen." };
  }
  revalidatePath(`/c/${input.clubSlug}`, "layout");
  return { success: true as const, created: free.length, skipped };
}

/**
 * Trainer: ein Kurs über mehrere Plätze, je Zeile eigene Zeit und Dauer (bis 8 h), gratis.
 * Alles oder nichts: bei einer Kollision wird nichts gebucht.
 */
export async function createCoachBlockAction(input: {
  clubSlug: string;
  name: string;
  /** rrggbb without # */
  color?: string;
  items: { courtId: string; startsAt: string; durationMinutes: number }[];
}) {
  const session = await auth();
  const tenant = await getTenantBySlug(input.clubSlug);
  if (!session?.user?.id || !tenant || !process.env.DATABASE_URL) return { success: false as const, error: "Bitte melde dich an." };
  const userId = session.user.id;
  const member = await getMemberContext(tenant.id, userId);
  if (member?.role !== "COACH" && !isClubAdminFor(session.user, input.clubSlug)) {
    return { success: false as const, error: "Kursbuchungen sind Trainern vorbehalten." };
  }
  const name = input.name.trim().slice(0, 80);
  if (!name) return { success: false as const, error: "Bitte einen Kursnamen angeben." };
  if (!input.items.length || input.items.length > 400) return { success: false as const, error: "Zu viele Termine (max. 400)." };

  const courts = await getCourtsByTenantId(tenant.id);
  const cutoff = lateBookingCutoff(tenant.settingsJson);
  const parsed: { court: (typeof courts)[number]; s: Date; e: Date; minutes: number; row: number }[] = [];
  for (const [i, it] of input.items.entries()) {
    const court = courts.find((c) => c.id === it.courtId);
    const s = new Date(it.startsAt);
    const minutes = it.durationMinutes;
    if (!court || court.status !== "ACTIVE") return { success: false as const, error: `Zeile ${i + 1}: Platz nicht gefunden.` };
    if (Number.isNaN(s.getTime()) || !Number.isInteger(minutes) || minutes < 30 || minutes > 480) {
      return { success: false as const, error: `Zeile ${i + 1}: Ungültige Zeit oder Dauer.` };
    }
    if (s.getTime() < cutoff) return { success: false as const, error: `Zeile ${i + 1}: Dieser Zeitslot hat bereits begonnen.` };
    parsed.push({ court, s, e: new Date(s.getTime() + minutes * 60_000), minutes, row: i + 1 });
  }

  const from = new Date(Math.min(...parsed.map((p) => p.s.getTime())) - 9 * HOUR).toISOString();
  const to = new Date(Math.max(...parsed.map((p) => p.e.getTime()))).toISOString();
  const [taken, blocks] = await Promise.all([getBookingsInRange(tenant.id, from, to), getBlocksInRange(tenant.id, from, to)]);
  const hit = (p: (typeof parsed)[number]) => (b: { courtId: string; startsAt: string; endsAt: string; status?: string }) =>
    b.status !== "CANCELLED" && b.courtId === p.court.id && p.s.getTime() < new Date(b.endsAt).getTime() && p.e.getTime() > new Date(b.startsAt).getTime();
  const clash = parsed.filter((p, i) => taken.some(hit(p)) || blocks.some(hit(p)) || parsed.some((q, j) => j < i && q.court.id === p.court.id && q.s < p.e && q.e > p.s));
  if (clash.length) {
    return { success: false as const, error: `Nicht frei: ${clash.map((p) => `Zeile ${p.row} (${p.court.name})`).join(", ")}. Nichts wurde gebucht.` };
  }

  const kursId = randomUUID().slice(0, 8);
  try {
    await prisma.$transaction(
      parsed.map((p, n) =>
        prisma.booking.create({
          data: {
            tenantId: tenant.id,
            courtId: p.court.id,
            organizerId: userId,
            createdById: userId,
            startsAt: p.s,
            endsAt: p.e,
            bookingType: "COACH",
            hasLighting: needsFloodlight(p.court, p.s, p.minutes),
            price: 0,
            totalCost: 0,
            paymentMethod: null,
            paymentStatus: "WAIVED",
            idempotencyKey: `${KURS}${kursId}:${n}${input.color && HEX.test(input.color) ? `:${input.color}` : ""}`,
            notes: name,
            participants: { create: [{ userId, role: "COACH", invitationStatus: "ACCEPTED" }] },
          },
        })
      )
    );
  } catch (e) {
    // the exclusion constraint caught a booking made in the meantime
    console.error("Kurs creation failed:", e);
    return { success: false as const, error: "Kurs fehlgeschlagen. Ein Platz wurde eventuell gerade vergeben, bitte erneut versuchen." };
  }
  revalidatePath(`/c/${input.clubSlug}`, "layout");
  return { success: true as const, created: parsed.length };
}

/**
 * Kurs bearbeiten: Name ändern, je Platz die Dauer ändern oder den Platz streichen, gilt für alle
 * künftigen Termine des Kurses. Alles oder nichts; eigene Termine zählen nicht als Konflikt.
 */
export async function editCoachCourseAction(input: {
  clubSlug: string;
  kursId: string;
  name?: string;
  color?: string;
  courts?: { courtId: string; minutes?: number; remove?: boolean }[];
}) {
  const session = await auth();
  const tenant = await getTenantBySlug(input.clubSlug);
  if (!session?.user?.id || !tenant || !process.env.DATABASE_URL) return { success: false as const, error: "Bitte melde dich an." };
  const isAdmin = isClubAdminFor(session.user, input.clubSlug);
  const now = new Date();
  const future = await prisma.booking.findMany({
    where: { tenantId: tenant.id, idempotencyKey: { startsWith: `${KURS}${input.kursId}:` }, status: { not: "CANCELLED" }, startsAt: { gt: now } },
  });
  if (!future.length) return { success: false as const, error: "Kurs nicht gefunden oder keine künftigen Termine." };
  if (!isAdmin && future.some((b) => b.organizerId !== session.user.id)) return { success: false as const, error: "Keine Berechtigung." };

  const name = input.name?.trim().slice(0, 80);
  const edits = new Map((input.courts ?? []).map((c) => [c.courtId, c]));
  const updates: { id: string; endsAt: Date }[] = [];
  const removed: string[] = [];
  for (const b of future) {
    const e = edits.get(b.courtId);
    if (e?.remove) removed.push(b.id);
    else if (e?.minutes) {
      if (!Number.isInteger(e.minutes) || e.minutes < 30 || e.minutes > 480) return { success: false as const, error: "Ungültige Dauer." };
      updates.push({ id: b.id, endsAt: new Date(b.startsAt.getTime() + e.minutes * 60_000) });
    }
  }
  if (updates.length) {
    const from = new Date(Math.min(...future.map((b) => b.startsAt.getTime())) - 9 * HOUR).toISOString();
    const to = new Date(Math.max(...updates.map((u) => u.endsAt.getTime()))).toISOString();
    const own = new Set(future.map((b) => b.id));
    const [taken, blocks] = await Promise.all([getBookingsInRange(tenant.id, from, to), getBlocksInRange(tenant.id, from, to)]);
    const byId = new Map(future.map((b) => [b.id, b]));
    const clash = updates.filter((u) => {
      const b = byId.get(u.id)!;
      const hit = (x: { courtId: string; startsAt: string; endsAt: string }) =>
        x.courtId === b.courtId && b.startsAt.getTime() < new Date(x.endsAt).getTime() && u.endsAt.getTime() > new Date(x.startsAt).getTime();
      return taken.some((x) => x.status !== "CANCELLED" && !own.has(x.id) && hit(x)) || blocks.some(hit);
    });
    if (clash.length) {
      return { success: false as const, error: `${clash.length} Termin(e) kollidieren mit anderen Buchungen, z.B. am ${byId.get(clash[0].id)!.startsAt.toLocaleDateString("de-CH")}. Nichts wurde geändert.` };
    }
  }
  await prisma.$transaction([
    ...updates.map((u) => prisma.booking.update({ where: { id: u.id }, data: { endsAt: u.endsAt } })),
    ...(removed.length
      ? [prisma.booking.updateMany({ where: { id: { in: removed } }, data: { status: "CANCELLED", cancelledAt: now, cancelledById: session.user.id } })]
      : []),
    ...(input.color && HEX.test(input.color)
      ? future.filter((b) => !removed.includes(b.id)).map((b) => prisma.booking.update({ where: { id: b.id }, data: { idempotencyKey: `${KURS}${input.kursId}:${b.idempotencyKey!.split(":")[2]}:${input.color}` } }))
      : []),
    ...(name ? [prisma.booking.updateMany({ where: { id: { in: future.map((b) => b.id) } }, data: { notes: name } })] : []),
  ]);
  revalidatePath(`/c/${input.clubSlug}`, "layout");
  return { success: true as const };
}

/** Cancel every future booking of the series `bookingId` belongs to. Invoice bookings: nothing to refund. */
export async function cancelSeriesAction(bookingId: string, clubSlug: string) {
  const session = await auth();
  const tenant = await getTenantBySlug(clubSlug);
  if (!session?.user?.id || !tenant || !process.env.DATABASE_URL) return { success: false as const, error: "Bitte melde dich an." };
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  const id = seriesOf(b?.idempotencyKey);
  if (!b || !id || b.tenantId !== tenant.id) return { success: false as const, error: "Serie nicht gefunden." };
  const isClubAdmin = isClubAdminFor(session.user, clubSlug);
  if (b.organizerId !== session.user.id && !isClubAdmin) return { success: false as const, error: "Keine Berechtigung." };
  const from = isClubAdmin ? new Date() : new Date(Date.now() + cancelDeadlineMinutes(tenant.settingsJson) * 60_000);
  // ponytail: plain status update, no wallet/Stripe refund; series are invoice-only (see createCoachSeriesAction)
  const r = await prisma.booking.updateMany({
    where: { tenantId: tenant.id, idempotencyKey: { startsWith: `${b.idempotencyKey!.split(":")[0]}:${id}:` }, startsAt: { gt: from }, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: session.user.id },
  });
  revalidatePath(`/c/${clubSlug}`, "layout");
  return { success: true as const, cancelled: r.count };
}

function cancelDeadlineError(startsAt: Date, settings: TenantSettings | null | undefined) {
  const t = startsAt.getTime();
  if (Date.now() >= t) return "Vergangene oder laufende Spiele können nicht storniert werden.";
  const deadline = cancelDeadlineMinutes(settings);
  if (t - Date.now() < deadline * 60_000) return `Stornierungen sind nur bis ${deadlineText(deadline)} vor Spielbeginn möglich.`;
  return null;
}

/** Cancel once, refund wallets and online payments, send the mail. */
async function cancelAndRefund(
  b: { id: string; tenantId: string; status: string; stripeSessionId: string | null },
  cancelledById: string | null
) {
  const walletRefund = await prisma.$transaction(async (tx) => {
    const r = await tx.booking.updateMany({
      where: { id: b.id, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById },
    });
    if (!r.count) return null;
    return refundBookingWallets(tx, b.id, `Erstattung nach Stornierung (Buchung ${b.id})`);
  });
  if (walletRefund === null) return { success: false as const, error: "Diese Buchung ist bereits storniert." };

  let refund = walletRefund;
  let refundFailed = false;
  if (b.stripeSessionId) {
    // ask Stripe, not the row read before the cancel: the payment may have landed in between
    const online = await refundStripeBooking(b.stripeSessionId).catch(async (e) => {
      console.error(`Stripe-Rückerstattung für Buchung ${b.id} fehlgeschlagen:`, e);
      refundFailed = true;
      await prisma.auditLog
        .create({ data: { tenantId: b.tenantId, action: "REFUND_FAILED", entityType: "Booking", entityId: b.id } })
        .catch(() => {});
      const club = await prisma.tenant.findUnique({ where: { id: b.tenantId }, select: { email: true, name: true } }).catch(() => null);
      if (club?.email) {
        await sendMail(club.email, `Rückerstattung fehlgeschlagen: Buchung ${b.id}`, `Die Buchung ${b.id} wurde storniert, die Stripe-Rückerstattung ist fehlgeschlagen.\nBitte im Stripe-Dashboard manuell erstatten.\n\nFehler: ${String(e)}`);
      }
      return 0;
    });
    refund += online;
    // still unpaid: close the open checkout so it can't be paid for a cancelled booking
    if (!online && !refundFailed) await getStripe().checkout.sessions.expire(b.stripeSessionId).catch(() => {});
  }
  refund = Math.round(refund * 100) / 100;
  if (b.status !== "PENDING" || refund > 0) await sendBookingCancellation(b.id, refund);
  if (refundFailed) {
    return { success: false as const, error: "Storniert, aber die Online-Rückerstattung ist fehlgeschlagen. Bitte melde dich beim Club, er erstattet den Betrag manuell." };
  }
  return { success: true as const, refundAmount: refund };
}

export async function cancelBookingAction(bookingId: string, clubSlug: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Bitte melde dich an, um eine Buchung zu stornieren." };
  }
  const userId = session.user.id;
  const isClubAdmin = isClubAdminFor(session.user, clubSlug);

  const tenant = await getTenantBySlug(clubSlug);
  if (!tenant) {
    return { success: false, error: "Club nicht gefunden." };
  }

  if (!process.env.DATABASE_URL) {
    const mb = mockDb.bookings.find((b) => b.id === bookingId && b.tenantId === tenant.id);
    if (!mb || (mb.organizerId !== userId && !isClubAdmin)) return { success: false, error: "Buchung nicht gefunden." };
    mockDb.cancelBooking(bookingId, userId);
    revalidatePath(`/c/${clubSlug}`, "layout");
    return { success: true, refundAmount: 0 };
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  // Scope strictly to the club the caller is acting in — a booking id from another
  // tenant must never be actionable just because the caller is an admin somewhere.
  if (!booking || booking.tenantId !== tenant.id) {
    return { success: false, error: "Buchung nicht gefunden." };
  }
  if (booking.organizerId !== userId && !isClubAdmin) {
    return { success: false, error: "Du hast keine Berechtigung, diese Buchung zu stornieren." };
  }
  if (!isClubAdmin) {
    const error = cancelDeadlineError(booking.startsAt, tenant.settingsJson);
    if (error) return { success: false, error };
  }

  const res = await cancelAndRefund(booking, userId);
  revalidatePath(`/c/${clubSlug}`, "layout");
  return res;
}

/** Guest self-service from the mail link: the HMAC token stands in for a login. */
export async function cancelBookingWithTokenAction(bookingId: string, token: string) {
  if (!process.env.DATABASE_URL || !verifyBookingToken(bookingId, token)) {
    return { success: false, error: "Ungültiger Link." };
  }
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { tenant: true } });
  if (!booking) return { success: false, error: "Buchung nicht gefunden." };
  const error = cancelDeadlineError(booking.startsAt, booking.tenant.settingsJson as TenantSettings | null);
  if (error) return { success: false, error };
  const res = await cancelAndRefund(booking, null);
  revalidatePath(`/c/${booking.tenant.slug}`, "layout");
  return res;
}

/** Admin: an open on-site/invoice booking is paid (cash, transfer) or waived; both are logged at the member. */
export async function markBookingPaidOfflineAction(clubSlug: string, bookingId: string, waive = false) {
  const session = await auth();
  if (!isClubAdminFor(session?.user, clubSlug)) return { success: false, error: "Keine Berechtigung." };
  const tenant = await getTenantBySlug(clubSlug);
  if (!tenant) return { success: false, error: "Club nicht gefunden." };
  const where = { id: bookingId, tenantId: tenant.id, paymentMethod: { in: ["ON_SITE" as const, "INVOICE" as const] }, paymentStatus: "UNPAID" as const };
  const b = await prisma.booking.findFirst({ where, include: { court: true } });
  const r = await prisma.booking.updateMany({ where, data: { paymentStatus: waive ? "WAIVED" : "PAID" } });
  if (b && r.count) {
    const when = b.startsAt.toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" });
    await logMoney({
      tenantId: tenant.id, actorId: session?.user?.id, action: waive ? "BOOKING_WAIVED" : "BOOKING_PAID_MANUAL", entityType: "Booking", entityId: b.id, userId: b.organizerId,
      text: `${b.court.name} ${when}: CHF ${Number(b.totalCost).toFixed(2)} ${waive ? "erlassen" : "als bezahlt markiert"}`,
    });
  }
  revalidatePath(`/c/${clubSlug}`, "layout");
  return r.count ? { success: true } : { success: false, error: "Buchung nicht gefunden oder bereits bezahlt." };
}

const TOP_UP_AMOUNTS = [20, 50, 100, 200];

/** Wallet top-up through Stripe Checkout; the webhook (or the return page) credits it. */
export async function topUpWalletAction(input: { clubSlug: string; amount: number }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { success: false, error: "Bitte melde dich an, um dein Guthaben aufzuladen." };
  }
  if (!TOP_UP_AMOUNTS.includes(input.amount)) {
    return { success: false, error: "Ungültiger Betrag." };
  }
  const tenant = await getTenantBySlug(input.clubSlug);
  if (!tenant || !process.env.DATABASE_URL) {
    return { success: false, error: "Club nicht gefunden." };
  }
  try {
    const checkout = await createCheckout({
      email: session.user.email,
      amount: input.amount,
      name: `Guthaben ${tenant.name}`,
      description: `Aufladung CHF ${input.amount}`,
      metadata: { purpose: "wallet_topup", tenantId: tenant.id, userId: session.user.id },
      successUrl: `${appUrl()}/c/${input.clubSlug}/profile?topup={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl()}/c/${input.clubSlug}/profile`,
    });
    return { success: true, checkoutUrl: checkout.url };
  } catch (e) {
    console.error("Top-up checkout failed:", e);
    return { success: false, error: "Zahlung konnte nicht gestartet werden." };
  }
}

export async function createCourtBlockAction(input: {
  clubSlug: string;
  /** one block per entry; the admin form sends one per day and court */
  items: { courtId: string; startsAt: string; endsAt: string }[];
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

  if (!input.items.length || input.items.length > 1000) {
    return { success: false, error: "Ungültige Anzahl Sperren." };
  }
  const courtIds = new Set((await getCourtsByTenantId(tenant.id)).map((c) => c.id));
  if (!input.items.every((i) => courtIds.has(i.courtId))) {
    return { success: false, error: "Der ausgewählte Platz gehört nicht zu diesem Club." };
  }
  if (!input.items.every((i) => new Date(i.endsAt).getTime() > new Date(i.startsAt).getTime())) {
    return { success: false, error: "Das Ende muss nach dem Beginn liegen." };
  }

  if (process.env.DATABASE_URL) {
    try {
      await prisma.courtBlock.createMany({
        data: input.items.map((i) => ({
          tenantId: tenant.id,
          courtId: i.courtId,
          startsAt: new Date(i.startsAt),
          endsAt: new Date(i.endsAt),
          reason: input.reason,
          description: input.description || null,
          createdById: session.user.id,
        })),
      });
    } catch (e) {
      console.warn("Prisma court block creation failed:", e);
      return { success: false, error: "Sperre konnte nicht gespeichert werden." };
    }
  } else {
    for (const i of input.items) {
      mockDb.createCourtBlock({
        tenantId: tenant.id,
        courtId: i.courtId,
        startsAt: i.startsAt,
        endsAt: i.endsAt,
        reason: input.reason,
        description: input.description,
        createdById: session.user.id,
      });
    }
  }

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

export async function updateCourtBlockAction(input: {
  clubSlug: string;
  blockId: string;
  courtId: string;
  startsAt: string;
  endsAt: string;
  reason: BlockReason;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const isClubAdmin =
    Boolean(session.user.isPlatformAdmin || session.user.role === "PLATFORM_ADMIN") ||
    session.user.tenants?.some((t) => t.slug === input.clubSlug && t.role === "CLUB_ADMIN");
  if (!isClubAdmin) return { success: false, error: "Keine Berechtigung in diesem Club." };
  const tenant = await getTenantBySlug(input.clubSlug);
  if (!tenant) return { success: false, error: "Club nicht gefunden." };
  const courtIds = new Set((await getCourtsByTenantId(tenant.id)).map((c) => c.id));
  if (!courtIds.has(input.courtId)) return { success: false, error: "Der ausgewählte Platz gehört nicht zu diesem Club." };
  const startsAt = new Date(input.startsAt), endsAt = new Date(input.endsAt);
  if (!(endsAt.getTime() > startsAt.getTime())) return { success: false, error: "Das Ende muss nach dem Beginn liegen." };
  const data = { courtId: input.courtId, startsAt, endsAt, reason: input.reason, description: input.description?.trim() || null };

  if (process.env.DATABASE_URL) {
    const r = await prisma.courtBlock.updateMany({ where: { id: input.blockId, tenantId: tenant.id }, data }).catch(() => null);
    if (!r?.count) return { success: false, error: "Sperre nicht gefunden." };
  } else {
    const b = mockDb.courtBlocks.find((x) => x.id === input.blockId && x.tenantId === tenant.id);
    if (!b) return { success: false, error: "Sperre nicht gefunden." };
    Object.assign(b, { ...data, startsAt: input.startsAt, endsAt: input.endsAt, description: data.description ?? undefined });
  }
  revalidatePath(`/c/${input.clubSlug}`, "layout");
  return { success: true };
}
