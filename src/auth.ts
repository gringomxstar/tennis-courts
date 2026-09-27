import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { mockDb } from "@/lib/data/mock-db";
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
          return null;
        }

        const { email, password } = parsedCredentials.data;
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Try Live Database if configured
        if (process.env.DATABASE_URL) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: normalizedEmail },
              include: {
                tenantUsers: {
                  include: {
                    tenant: true,
                  },
                },
              },
            });

            if (dbUser && dbUser.passwordHash) {
              const passwordsMatch = await bcrypt.compare(password, dbUser.passwordHash);
              if (passwordsMatch) {
                // Determine primary role & tenants
                const isPlatformAdmin = dbUser.tenantUsers.some(
                  (tu) => tu.role === "PLATFORM_ADMIN"
                );
                const primaryRole: TenantRole = isPlatformAdmin
                  ? "PLATFORM_ADMIN"
                  : (dbUser.tenantUsers[0]?.role as TenantRole) || "MEMBER";

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
              }
            }
          } catch (e) {
            console.warn("Database lookup failed, falling back to mock:", e);
          }
        }

        // 2. Mock Store Fallback
        const mockUser = mockDb.getUserByEmail(normalizedEmail);
        if (mockUser) {
          // Allow demo passwords: 'tennis12345' or 'admin12345' or any password for demo ease
          const isValidDemoPassword =
            password === "tennis12345" ||
            password === "admin12345" ||
            password === "password" ||
            password.length >= 6;

          if (isValidDemoPassword) {
            const isPlatformAdmin = mockUser.role === "PLATFORM_ADMIN" || Boolean(mockUser.isPlatformAdmin);
            return {
              id: mockUser.id,
              email: mockUser.email,
              name: `${mockUser.firstName} ${mockUser.lastName}`,
              role: mockUser.role,
              isPlatformAdmin,
              tenants: [
                {
                  tenantId: mockUser.tenantId || "tenant-rot-weiss",
                  slug: "tc-rot-weiss",
                  role: mockUser.role,
                },
              ],
            };
          }
        }

        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET || "tennis-secret-jwt-key-32-chars-minimum-token",
});
