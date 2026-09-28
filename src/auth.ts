import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { TenantRole } from "@/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials);
        if (!parsedCredentials.success) {
          throw new Error("Ungültige Eingabe");
        }

        const { email, password } = parsedCredentials.data;
        const normalizedEmail = email.toLowerCase().trim();

        if (!process.env.DATABASE_URL) {
          throw new Error("Datenbank nicht verbunden");
        }

        const dbUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: {
            tenantUsers: {
              include: { tenant: true },
            },
          },
        });

        if (!dbUser || !dbUser.passwordHash) {
          throw new Error("Benutzer nicht gefunden");
        }

        const passwordsMatch = await bcrypt.compare(password, dbUser.passwordHash);
        if (!passwordsMatch) {
          throw new Error("Falsches Passwort");
        }

        // Bestimme primäre Rolle & Tenants
        const isPlatformAdmin = dbUser.tenantUsers.some(
          (tu) => tu.role === "PLATFORM_ADMIN"
        );
        const primaryRole: TenantRole = isPlatformAdmin
          ? "PLATFORM_ADMIN"
          : (dbUser.tenantUsers[0]?.role as TenantRole) || "GUEST";

        return {
          id: dbUser.id,
          email: dbUser.email,
          name: `${dbUser.firstName} ${dbUser.lastName}`,
          role: primaryRole,
          isPlatformAdmin,
          tenants: dbUser.tenantUsers.map((tu) => ({
            tenantId: tu.tenantId,
            slug: tu.tenant.slug,
            role: tu.role as TenantRole,
          })),
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET || "tennis-secret-jwt-key-32-chars-minimum-token",
});
