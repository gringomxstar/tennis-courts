"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { mockDb } from "@/lib/data/mock-db";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  firstName: z.string().min(2, "Vorname muss mindestens 2 Zeichen lang sein"),
  lastName: z.string().min(2, "Nachname muss mindestens 2 Zeichen lang sein"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen lang sein"),
  tenantSlug: z.string().min(1, "Bitte wähle einen Tennisclub aus"),
  phone: z.string().optional(),
});

export async function loginWithCredentials(
  prevState: { error?: string } | undefined,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/c/tc-marly";

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

// Fixed allowlist of the exact demo personas the login page advertises. quickDemoLogin
// must never accept an arbitrary client-supplied email — it authenticates via the same
// real credential check as loginWithCredentials, but should only ever do so for these.
const DEMO_ACCOUNTS: Record<string, { password: string; callbackUrl: (slug: string) => string }> = {
  "member@marly.ch": { password: "tennis12345", callbackUrl: (slug) => `/c/${slug}` },
  "clubadmin@marly.ch": { password: "admin12345", callbackUrl: (slug) => `/c/${slug}` },
  "admin@tennisapp.ch": { password: "admin12345", callbackUrl: () => "/admin" },
};

export async function quickDemoLogin(email: string, targetSlug: string = "tc-marly") {
  const account = DEMO_ACCOUNTS[email];
  if (!account) {
    return { error: "Unbekannter Demo-Account." };
  }

  try {
    await signIn("credentials", {
      email,
      password: account.password,
      redirectTo: account.callbackUrl(targetSlug),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Demo-Login fehlgeschlagen." };
    }
    throw error;
  }
}

export async function registerUserAction(
  prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const rawData = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
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

  // Check if live DB configured
  if (process.env.DATABASE_URL) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingUser) {
        return { error: "Diese E-Mail-Adresse ist bereits registriert." };
      }

      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
      });
      if (!tenant) {
        return { error: "Ausgewählter Club wurde nicht gefunden." };
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
              role: "MEMBER",
            },
          },
        },
      });

      if (user) {
        await signIn("credentials", {
          email: normalizedEmail,
          password,
          redirectTo: `/c/${tenantSlug}`,
        });
        return { success: true };
      }
    } catch (e: unknown) {
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
    redirectTo: `/c/${tenantSlug}`,
  });

  return { success: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
