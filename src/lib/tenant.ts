import { auth } from "@/auth";
import { getTenantBySlug } from "@/lib/data";
import { redirect } from "next/navigation";
import { cache } from "react";
import { Tenant, TenantRole } from "@/types";

export interface TenantContext {
  tenant: Tenant;
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: TenantRole;
    isPlatformAdmin: boolean;
  } | null;
  isTenantAdmin: boolean;
  isPlatformAdmin: boolean;
  canBook: boolean;
}

export async function getCurrentSession() {
  return await auth();
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

// cache(): layout + page both call this per request — dedupe the tenant query.
export const getTenantContext = cache(async function getTenantContext(slug: string): Promise<TenantContext> {
  const [tenant, session] = await Promise.all([getTenantBySlug(slug), auth()]);
  if (!tenant) {
    redirect("/?error=TenantNotFound");
  }

  const rawUser = session?.user;

  if (!rawUser) {
    return {
      tenant,
      user: null,
      isTenantAdmin: false,
      isPlatformAdmin: false,
      canBook: Boolean(tenant.settingsJson?.allowGuestBookings),
    };
  }

  const isPlatformAdmin = Boolean(rawUser.isPlatformAdmin || rawUser.role === "PLATFORM_ADMIN");
  
  // Find role strictly in this specific tenant (no cross-tenant leakage!)
  let tenantRole: TenantRole = "GUEST";
  if (isPlatformAdmin) {
    tenantRole = "PLATFORM_ADMIN";
  } else if (rawUser.tenants && Array.isArray(rawUser.tenants)) {
    const matchingTenant = rawUser.tenants.find((t) => t.slug === slug);
    if (matchingTenant) {
      tenantRole = matchingTenant.role;
    }
  }

  const isTenantAdmin =
    isPlatformAdmin || tenantRole === "CLUB_ADMIN" || tenantRole === "PLATFORM_ADMIN";

  return {
    tenant,
    user: {
      id: rawUser.id,
      email: rawUser.email || "",
      name: rawUser.name,
      role: tenantRole,
      isPlatformAdmin,
    },
    isTenantAdmin,
    isPlatformAdmin,
    canBook: true,
  };
});

export async function requirePlatformAdmin() {
  const session = await auth();
  const user = session?.user;
  if (!user || (!user.isPlatformAdmin && user.role !== "PLATFORM_ADMIN")) {
    redirect("/login?error=UnauthorizedAdmin");
  }
  return user;
}

export async function requireTenantAdmin(slug: string) {
  const context = await getTenantContext(slug);
  if (!context.isTenantAdmin) {
    redirect(`/c/${slug}?error=Unauthorized`);
  }
  return context;
}
