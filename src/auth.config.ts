import type { NextAuthConfig } from "next-auth";
import { TenantRole } from "@/types";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const user = auth?.user;
      const pathname = nextUrl.pathname;

      // Platform admin route protection: /admin
      if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) return false;
        // User must be platform admin
        if (!user?.isPlatformAdmin && user?.role !== "PLATFORM_ADMIN") {
          return Response.redirect(new URL("/login?error=UnauthorizedAdmin", nextUrl));
        }
        return true;
      }

      // Club admin route protection: /c/[clubSlug]/admin
      if (pathname.includes("/admin")) {
        if (!isLoggedIn) return false;
        // Extract club slug: /c/([a-zA-Z0-9_-]+)/admin
        const match = pathname.match(/^\/c\/([^/]+)\/admin/);
        if (match) {
          const clubSlug = match[1];
          const hasRole =
            user?.isPlatformAdmin ||
            user?.role === "PLATFORM_ADMIN" ||
            user?.role === "CLUB_ADMIN" ||
            user?.tenants?.some(
              (t) =>
                t.slug === clubSlug &&
                (t.role === "CLUB_ADMIN" || t.role === "PLATFORM_ADMIN")
            );
          if (!hasRole) {
            return Response.redirect(new URL(`/c/${clubSlug}?error=Unauthorized`, nextUrl));
          }
        }
        return true;
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isPlatformAdmin = user.isPlatformAdmin;
        token.tenants = user.tenants;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || session.user.id;
        session.user.role = token.role as TenantRole;
        session.user.isPlatformAdmin = Boolean(token.isPlatformAdmin);
        session.user.tenants = token.tenants as typeof session.user.tenants;
      }
      return session;
    },
  },
  providers: [],
};
