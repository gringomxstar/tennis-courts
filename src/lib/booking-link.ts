import { createHmac, timingSafeEqual } from "node:crypto";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Unguessable per-booking token, so guests without an account can open their booking from the mail. */
// same fallback as src/auth.ts
const sign = (msg: string) =>
  createHmac("sha256", process.env.AUTH_SECRET || "tennis-secret-jwt-key-32-chars-minimum-token")
    .update(msg)
    .digest("base64url")
    .slice(0, 32);

const same = (expected: string, token: string | undefined) => {
  if (!token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};

export function bookingToken(bookingId: string) {
  return sign(`booking:${bookingId}`);
}

export function verifyBookingToken(bookingId: string, token: string | undefined) {
  return same(bookingToken(bookingId), token);
}

/**
 * "Passwort setzen" link token (invite, activation, reset). It signs the current password hash,
 * so it stops working as soon as a password is set — single use without a token table.
 */
export function passwordToken(userId: string, passwordHash: string | null, exp: number) {
  return sign(`pw:${userId}:${passwordHash ?? ""}:${exp}`);
}

export function verifyPasswordToken(
  userId: string,
  passwordHash: string | null,
  exp: number,
  token: string | undefined,
  now = Date.now()
) {
  return Number.isFinite(exp) && exp > now && same(passwordToken(userId, passwordHash, exp), token);
}

export function passwordLink(slug: string, userId: string, passwordHash: string | null, days = 14) {
  const exp = Date.now() + days * 86_400_000;
  return `${appUrl()}/c/${slug}/passwort?u=${userId}&e=${exp}&t=${passwordToken(userId, passwordHash, exp)}`;
}

export const bookingLink = (slug: string, bookingId: string) =>
  `${appUrl()}/c/${slug}/buchung/${bookingId}?t=${bookingToken(bookingId)}`;

/**
 * Guest → account on the booking page is offered directly only if the guest identity has no other
 * history to take over: no other booking that isn't cancelled (aborted/expired checkouts don't count).
 * Otherwise the "Passwort setzen" link goes to the mailbox, which proves ownership.
 */
export async function claimableByBooking(organizerId: string, bookingId: string) {
  const { prisma } = await import("@/lib/prisma");
  const other = await prisma.booking.count({
    where: { organizerId, id: { not: bookingId }, status: { not: "CANCELLED" } },
  });
  return other === 0;
}
