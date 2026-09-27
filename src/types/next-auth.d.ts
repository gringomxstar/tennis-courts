import { DefaultSession } from "next-auth";
import { TenantRole } from "./index";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: TenantRole;
      isPlatformAdmin?: boolean;
      tenants?: {
        tenantId: string;
        slug: string;
        role: TenantRole;
      }[];
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: TenantRole;
    isPlatformAdmin?: boolean;
    tenants?: {
      tenantId: string;
      slug: string;
      role: TenantRole;
    }[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: TenantRole;
    isPlatformAdmin?: boolean;
    tenants?: {
      tenantId: string;
      slug: string;
      role: TenantRole;
    }[];
  }
}
