"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/app/actions/auth";
import { Calendar, Shield, LogOut, Trophy } from "lucide-react";
import { Tenant, TenantRole } from "@/types";

interface NavbarProps {
  currentTenant?: Tenant | null;
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role?: TenantRole;
    isPlatformAdmin?: boolean;
  } | null;
}

export function Navbar({ currentTenant, user }: NavbarProps) {
  const pathname = usePathname();

  const getRoleBadge = (role?: TenantRole, isPlatformAdmin?: boolean) => {
    if (isPlatformAdmin || role === "PLATFORM_ADMIN") {
      return <Badge className="bg-purple-600 hover:bg-purple-700 text-white">Plattform Admin</Badge>;
    }
    if (role === "CLUB_ADMIN") {
      return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">Club Admin</Badge>;
    }
    if (role === "MEMBER") {
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Mitglied</Badge>;
    }
    return <Badge variant="secondary">Gast</Badge>;
  };

  const isTenantAdmin =
    user?.isPlatformAdmin ||
    user?.role === "PLATFORM_ADMIN" ||
    user?.role === "CLUB_ADMIN";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs dark:border-slate-800 dark:bg-slate-900/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Tenant Info */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
              🎾
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base leading-tight tracking-tight text-slate-900 dark:text-white">
                TennisCourts
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Reservation & Club OS</span>
            </div>
          </Link>

          {currentTenant && (
            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-800">
              <Link
                href={`/c/${currentTenant.slug}`}
                className="text-sm font-semibold text-slate-800 hover:text-emerald-600 dark:text-slate-200 transition-colors flex items-center gap-1.5"
              >
                <span>{currentTenant.name}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Center: Navigation Links when inside a Club */}
        {currentTenant && (
          <nav className="hidden md:flex items-center gap-1">
            <Link href={`/c/${currentTenant.slug}`}>
              <Button
                variant={pathname === `/c/${currentTenant.slug}` ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
              >
                <Calendar className="w-4 h-4 text-emerald-600" />
                Kalender
              </Button>
            </Link>

            {user && (
              <Link href={`/c/${currentTenant.slug}/bookings`}>
                <Button
                  variant={pathname.includes("/bookings") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5"
                >
                  <Trophy className="w-4 h-4 text-slate-500" />
                  Meine Buchungen
                </Button>
              </Link>
            )}

            {isTenantAdmin && (
              <Link href={`/c/${currentTenant.slug}/admin`}>
                <Button
                  variant={pathname.includes("/admin") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5 text-amber-700 hover:text-amber-800 dark:text-amber-400"
                >
                  <Shield className="w-4 h-4" />
                  Club verwalten
                </Button>
              </Link>
            )}
          </nav>
        )}

        {/* Right: Auth & User Menu */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                  {user.name || user.email}
                </span>
                <div className="mt-0.5">{getRoleBadge(user.role, user.isPlatformAdmin)}</div>
              </div>

              {user.isPlatformAdmin && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="hidden lg:flex text-purple-700 border-purple-200 hover:bg-purple-50">
                    Plattform Admin
                  </Button>
                </Link>
              )}

              <form action={logoutAction}>
                <Button variant="outline" size="sm" type="submit" title="Abmelden" className="gap-1.5">
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Abmelden</span>
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href={`/login${currentTenant ? `?callbackUrl=/c/${currentTenant.slug}` : ""}`}>
                <Button variant="ghost" size="sm">
                  Anmelden
                </Button>
              </Link>
              <Link href={`/register${currentTenant ? `?club=${currentTenant.slug}` : ""}`}>
                <Button size="sm">Mitglied werden</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
