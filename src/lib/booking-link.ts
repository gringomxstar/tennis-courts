import { createHmac, timingSafeEqual } from "node:crypto";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Unguessable per-booking token, so guests without an account can open their booking from the mail. */
export function bookingToken(bookingId: string) {
  // same fallback as src/auth.ts
  const secret = process.env.AUTH_SECRET || "tennis-secret-jwt-key-32-chars-minimum-token";
  return createHmac("sha256", secret).update(`booking:${bookingId}`).digest("base64url").slice(0, 32);
}

export function verifyBookingToken(bookingId: string, token: string | undefined) {
  if (!token) return false;
  const a = Buffer.from(bookingToken(bookingId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const bookingLink = (slug: string, bookingId: string) =>
  `${appUrl()}/c/${slug}/buchung/${bookingId}?t=${bookingToken(bookingId)}`;
