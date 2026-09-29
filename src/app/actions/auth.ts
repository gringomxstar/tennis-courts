"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { unstable_rethrow } from "next/navigation";
import { mockDb } from "@/lib/data/mock-db";
import { getAllTenants } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { claimableByBooking, passwordLink, verifyBookingToken, verifyPasswordToken } from "@/lib/booking-link";
import { sendPasswordLink } from "@/lib/mail";
import { DEMO_ACCOUNTS, demoModeOn, isDemoEmail } from "@/lib/demo";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  firstName: z.string().trim().min(2, "Vorname muss mindestens 2 Zeichen lang sein"),
  lastName: z.string().trim().default(""),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen lang sein"),
  tenantSlug: z.string().min(1, "Bitte wähle einen Tennisclub aus"),
  phone: z.string().optional(),
});

/** Only same-site paths ("/x", never "//host" or "/\host") may be used as a redirect target. */
const safePath = (p: unknown, fallback: string) =>
  typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") ? p : fallback;

const MIN_PASSWORD = 6;

async function firstClubPath() {
  const [first] = await getAllTenants();
  return first ? `/c/${first.slug}` : "/";
}

export async function loginWithCredentials(
  prevState: { error?: string } | undefined,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const callbackUrl = safePath(formData.get("callbackUrl"), await firstClubPath());

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Ungültige E-Mail-Adresse oder falsches Passwort." };
        default:
          return { error: "Ein Fehler ist bei der Anmeldung aufgetreten." };
      }
    }
    throw error;
  }
}

/** Demo role switcher. Only the fixed personas, only while the club has demo mode on (src/auth.ts checks it too). */
export async function quickDemoLogin(email: string, targetSlug: string, redirectTo?: string) {
  if (!isDemoEmail(email)) return { error: "Unbekannter Demo-Account." };
  const tenant = process.env.DATABASE_URL
    ? await prisma.tenant.findUnique({ where: { slug: targetSlug }, select: { settingsJson: true } })
    : null;
  if (!demoModeOn(tenant?.settingsJson)) return { error: "Der Demo-Modus ist ausgeschaltet." };

  try {
    await signIn("credentials", {
      email,
      password: DEMO_ACCOUNTS[email].password,
      redirectTo: safePath(redirectTo, `/c/${targetSlug}`),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Demo-Login fehlgeschlagen." };
    }
    throw error;
  }
}

/** Log out and land on the club start (demo "Gast" row). */
export async function signOutToClubAction(slug: string) {
  await signOut({ redirectTo: /^[a-z0-9-]+$/.test(slug) ? `/c/${slug}` : "/" });
}

export async function registerUserAction(
  prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const rawData = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    tenantSlug: formData.get("tenantSlug"),
    phone: formData.get("phone") || undefined,
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validierungsfehler" };
  }

  const { firstName, lastName, email, password, tenantSlug, phone } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const redirectTo = safePath(formData.get("callbackUrl"), `/c/${tenantSlug}`);

  // Check if live DB configured
  if (process.env.DATABASE_URL) {
    try {
      const [existingUser, tenant] = await Promise.all([
        prisma.user.findUnique({ where: { email: normalizedEmail } }),
        prisma.tenant.findUnique({ where: { slug: tenantSlug } }),
      ]);
      if (!tenant) {
        return { error: "Ausgewählter Club wurde nicht gefunden." };
      }
      if (existingUser && !existingUser.passwordHash) {
        // A guest booking created this identity: proof of the mailbox comes via the link, not this form.
        if (!throttled(existingUser.email)) await sendPasswordLink(
          existingUser.email,
          existingUser.firstName,
          tenant.name,
          passwordLink(tenantSlug, existingUser.id, null),
          "reset"
        );
        return { error: "Du hast schon als Gast gebucht – wir haben dir einen Link geschickt, um dein Passwort zu setzen." };
      }
      if (existingUser) {
        return { error: "Diese E-Mail-Adresse ist bereits registriert." };
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName,
          lastName,
          phone,
          tenantUsers: {
            create: {
              tenantId: tenant.id,
              // MEMBER = paid Abo / club member (webhook, admin, import); a plain account pays like a guest
              role: "GUEST",
            },
          },
        },
      });

      if (user) {
        await signIn("credentials", {
          email: normalizedEmail,
          password,
          redirectTo,
        });
        return { success: true };
      }
    } catch (e: unknown) {
      unstable_rethrow(e); // the successful signIn redirect
      console.error("Registration in DB failed, using mock:", e);
    }
  }

  // Fallback in Mock store
  const existingMock = mockDb.getUserByEmail(normalizedEmail);
  if (existingMock) {
    return { error: "Diese E-Mail-Adresse ist im System bereits registriert." };
  }

  mockDb.registerUser({
    email: normalizedEmail,
    firstName,
    lastName,
    phone,
    tenantSlug,
  });

  await signIn("credentials", {
    email: normalizedEmail,
    password,
    redirectTo,
  });

  return { success: true };
}

// ponytail: per-instance throttle only (serverless = several instances); good enough against double taps and casual mail-bombing.
const lastLinkSent = new Map<string, number>();
function throttled(email: string) {
  const now = Date.now();
  if (now - (lastLinkSent.get(email) ?? 0) < 120_000) return true;
  lastLinkSent.set(email, now);
  return false;
}

/** "Passwort vergessen / Konto aktivieren". Same answer whether or not the email exists (no account enumeration). */
export async function requestPasswordLinkAction(
  prevState: { ok?: boolean; error?: string } | undefined,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const tenantSlug = String(formData.get("tenantSlug") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Bitte gib eine gültige E-Mail-Adresse an." };
  if (!process.env.DATABASE_URL) return { ok: true };

  if (throttled(email)) return { ok: true };

  const member = await prisma.tenantUser.findFirst({
    where: { tenant: { slug: tenantSlug }, user: { email, deletedAt: null } },
    include: { user: true, tenant: true },
  });
  if (member) {
    await sendPasswordLink(
      member.user.email,
      member.user.firstName,
      member.tenant.name,
      passwordLink(tenantSlug, member.user.id, member.user.passwordHash),
      "reset"
    );
  }
  return { ok: true };
}

/** Sets the password (single use: the old hash must still match), joins the club as GUEST if needed, signs in. */
async function setPasswordAndSignIn(
  user: { id: string; email: string; passwordHash: string | null },
  tenantId: string,
  password: string,
  redirectTo: string
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, passwordHash: user.passwordHash },
    data: { passwordHash, emailVerified: new Date() },
  });
  if (count !== 1) return { error: "Der Link wurde bereits benutzt." };
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    create: { tenantId, userId: user.id, role: "GUEST" },
    update: {}, // never change an existing role
  });
  try {
    await signIn("credentials", { email: user.email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Passwort gesetzt. Bitte melde dich jetzt an." };
    throw error;
  }
  return {};
}

export async function setPasswordAction(
  prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const slug = String(formData.get("slug") ?? "");
  const userId = String(formData.get("u") ?? "");
  const exp = Number(formData.get("e"));
  const token = String(formData.get("t") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.` };
  if (!process.env.DATABASE_URL) return { error: "Datenbank nicht verbunden." };

  const [user, tenant] = await Promise.all([
    userId ? prisma.user.findUnique({ where: { id: userId } }) : null,
    prisma.tenant.findUnique({ where: { slug } }),
  ]);
  if (!user || !tenant || user.deletedAt || !verifyPasswordToken(user.id, user.passwordHash, exp, token)) {
    return { error: "Link abgelaufen oder bereits benutzt." };
  }
  return setPasswordAndSignIn(user, tenant.id, password, `/c/${slug}`);
}

async function loadGuestBooking(slug: string, bookingId: string, token: string) {
  if (!process.env.DATABASE_URL || !verifyBookingToken(bookingId, token)) return null;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { organizer: true, tenant: true },
  });
  return booking && booking.tenant.slug === slug && !booking.organizer.passwordHash ? booking : null;
}

/** Guest → account from the booking page. Role stays GUEST (guest rates still apply). */
export async function claimGuestAccountAction(input: {
  slug: string;
  bookingId: string;
  token: string;
  password: string;
}): Promise<{ error?: string }> {
  if (input.password.length < MIN_PASSWORD) return { error: `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.` };
  const b = await loadGuestBooking(input.slug, input.bookingId, input.token);
  if (!b || !(await claimableByBooking(b.organizerId, b.id))) {
    return { error: "Das geht hier nicht mehr. Wir können dir einen Link per E-Mail schicken." };
  }
  return setPasswordAndSignIn(b.organizer, b.tenantId, input.password, `/c/${input.slug}/bookings`);
}

/** Booking page, older guest identity: mail a "Passwort setzen" link to the organizer instead. */
export async function sendGuestAccountLinkAction(input: {
  slug: string;
  bookingId: string;
  token: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const b = await loadGuestBooking(input.slug, input.bookingId, input.token);
  if (!b) return { error: "Link konnte nicht gesendet werden." };
  if (throttled(b.organizer.email)) return { ok: true };
  const sent = await sendPasswordLink(
    b.organizer.email,
    b.organizer.firstName,
    b.tenant.name,
    passwordLink(input.slug, b.organizer.id, null),
    "reset"
  );
  return sent ? { ok: true } : { error: "Link konnte nicht gesendet werden." };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
