import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { TenantRole } from "@/types";
import { demoModeOn, isDemoEmail } from "@/lib/demo";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Switching demo mode off must also end running demo sessions, not only new logins.
    // Costs one query per auth() call, but only for the demo personas.
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params);
      if (!token || params.user || !isDemoEmail(token.email)) return token;
      const live = await prisma.tenantUser.findMany({
        where: { user: { email: token.email! } },
        select: { tenant: { select: { settingsJson: true } } },
      });
      return live.some((tu) => demoModeOn(tu.tenant.settingsJson)) ? token : null;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials);
        if (!parsedCredentials.success) {
          return null; // Ungültige Eingabe -> CredentialsSignin
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
          return null; // Benutzer nicht gefunden -> CredentialsSignin
        }

        const passwordsMatch = await bcrypt.compare(password, dbUser.passwordHash);
        if (!passwordsMatch) {
          return null; // Falsches Passwort -> CredentialsSignin
        }

        // Demo passwords are public (repo): only valid while a club of this persona runs demo mode
        if (isDemoEmail(normalizedEmail) && !dbUser.tenantUsers.some((tu) => demoModeOn(tu.tenant.settingsJson))) {
          return null; // Demo-Modus ist aus -> CredentialsSignin
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
