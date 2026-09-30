import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { TenantRole } from "@/types";
import { demoModeOn, isDemoEmail } from "@/lib/demo";
import { authSecret } from "@/lib/secret";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Roles live in the JWT; re-read them from the DB every 5 min so a demoted/removed admin loses
    // access soon, not after the session expires. Demo personas also end when demo mode is off.
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params);
      if (!token || params.user) return token;
      const t = token as typeof token & { chk?: number };
      if (t.chk && Date.now() - t.chk < 300_000) return token;
      t.chk = Date.now();
      try {
        let live = await prisma.tenantUser.findMany({
          where: { user: { email: token.email! } },
          select: { tenantId: true, role: true, tenant: { select: { slug: true, settingsJson: true } } },
        });
        if (isDemoEmail(token.email)) {
          live = live.filter((tu) => demoModeOn(tu.tenant.settingsJson));
          if (!live.length) return null;
        }
        token.tenants = live.map((tu) => ({ tenantId: tu.tenantId, slug: tu.tenant.slug, role: tu.role as TenantRole }));
        token.isPlatformAdmin = live.some((tu) => tu.role === "PLATFORM_ADMIN");
        token.role = token.isPlatformAdmin ? "PLATFORM_ADMIN" : ((live[0]?.role as TenantRole) ?? "GUEST");
      } catch (e) {
        console.error("jwt refresh failed:", e); // DB blip: keep the session as is
      }
      return token;
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

        // Demo passwords are public (repo): only valid while a club of this persona runs demo mode,
        // and only for those clubs (a club with demo off must not open its admin role)
        if (isDemoEmail(normalizedEmail)) {
          dbUser.tenantUsers = dbUser.tenantUsers.filter((tu) => demoModeOn(tu.tenant.settingsJson));
          if (!dbUser.tenantUsers.length) return null; // Demo-Modus ist aus -> CredentialsSignin
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
  secret: authSecret(),
});
