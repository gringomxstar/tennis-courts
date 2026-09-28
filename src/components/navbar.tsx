"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/app/actions/auth";
import { topUpWalletAction } from "@/app/actions/booking";
import {
  Calendar,
  Shield,
  LogOut,
  Trophy,
  Sparkles,
  MapPin,
  Coins,
  Loader2,
} from "lucide-react";
import { Tenant, TenantRole } from "@/types";
import { ThemeToggle } from "./theme-toggle";

interface NavbarProps {
  currentTenant?: Tenant | null;
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role?: TenantRole;
    isPlatformAdmin?: boolean;
  } | null;
  wallet?: {
    balance: number;
    currency: string;
  } | null;
}

export function Navbar({ currentTenant, user, wallet }: NavbarProps) {
  const pathname = usePathname();
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [optimisticBalance, setOptimisticBalance] = useState<number | null>(null);

  const currentBalance =
    optimisticBalance !== null ? optimisticBalance : (wallet?.balance ?? 0);

  const handleTopUp = async () => {
    if (!currentTenant) return;
    setTopUpLoading(true);
    const res = await topUpWalletAction({ clubSlug: currentTenant.slug, amount: 50 });
    setTopUpLoading(false);
    if (res.success && res.balance !== undefined) {
      setOptimisticBalance(res.balance);
    }
  };

  const getRoleBadge = (role?: TenantRole, isPlatformAdmin?: boolean) => {
    if (isPlatformAdmin || role === "PLATFORM_ADMIN") {
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-semibold px-2 py-0.5">
          Plattform Admin
        </Badge>
      );
    }
    if (role === "CLUB_ADMIN") {
      return (
        <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold px-2 py-0.5">
          Club Admin
        </Badge>
      );
    }
    if (role === "MEMBER") {
      return (
        <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold px-2 py-0.5">
          Mitglied
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5">
        Gast
      </Badge>
    );
  };

  const isTenantAdmin =
    user?.isPlatformAdmin ||
    user?.role === "PLATFORM_ADMIN" ||
    user?.role === "CLUB_ADMIN";

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : "TC";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 dark:bg-background/90 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Tenant Info */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#E25B36] via-[#D84C25] to-[#B33816] flex items-center justify-center text-white shadow-md shadow-[#E25B36]/25 group-hover:scale-105 group-hover:shadow-[#E25B36]/35 transition-all">
              <span className="text-xl">🎾</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-foreground">
                  Tennis<span className="text-clay">Courts</span>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-clay/15 text-clay dark:bg-clay/20 dark:text-clay-hover rounded border border-clay/25">
                  Nocturne
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Grand Slam OS</span>
            </div>
          </Link>

          {currentTenant && (
            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-border">
              <Link
                href={`/c/${currentTenant.slug}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-muted-foreground bg-card hover:bg-clay/10 hover:text-clay dark:hover:bg-clay/15 dark:hover:text-clay-hover transition-colors border border-border"
              >
                <MapPin className="w-3.5 h-3.5 text-clay" />
                <span>{currentTenant.name}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Center: Navigation Links inside Club */}
        {currentTenant && (
          <nav className="hidden md:flex items-center gap-1 p-1 bg-card rounded-xl border border-border">
            <Link href={`/c/${currentTenant.slug}`}>
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  pathname === `/c/${currentTenant.slug}`
                    ? "bg-card dark:bg-accent text-clay dark:text-clay-hover shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-clay" />
                Kalender
              </button>
            </Link>

            {user && (
              <Link href={`/c/${currentTenant.slug}/bookings`}>
                <button
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    pathname.includes("/bookings")
                      ? "bg-card dark:bg-accent text-clay dark:text-clay-hover shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  Meine Buchungen
                </button>
              </Link>
            )}

            {isTenantAdmin && (
              <Link href={`/c/${currentTenant.slug}/admin`}>
                <button
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    pathname.includes("/admin")
                      ? "bg-card dark:bg-accent text-amber-600 dark:text-amber-400 shadow-xs"
                      : "text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  Club-Verwaltung
                </button>
              </Link>
            )}
          </nav>
        )}

        {/* Right: User Menu & Auth */}
        <div className="flex items-center gap-2.5">
          {/* User Credits Wallet Pill */}
          {user && currentTenant && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border text-xs font-semibold shadow-2xs">
              <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-foreground font-mono font-bold">
                {currentBalance.toFixed(0)} CHF
              </span>

            </div>
          )}

          {/* Theme Toggle (Day / Night) */}
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold flex items-center justify-center text-xs shadow-xs ring-2 ring-emerald-500/20">
                  {getInitials(user.name, user.email)}
                </div>

                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-bold text-foreground leading-tight">
                    {user.name || user.email.split("@")[0]}
                  </span>
                  <div className="mt-0.5">{getRoleBadge(user.role, user.isPlatformAdmin)}</div>
                </div>
              </div>

              {user.isPlatformAdmin && (
                <Link href="/admin">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden lg:flex text-xs h-8 text-purple-700 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
                  >
                    Plattform Admin
                  </Button>
                </Link>
              )}

              <form action={logoutAction}>
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  title="Abmelden"
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-rose-600 border-border"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href={`/login${currentTenant ? `?callbackUrl=/c/${currentTenant.slug}` : ""}`}>
                <Button variant="ghost" size="sm" className="text-xs h-8">
                  Anmelden
                </Button>
              </Link>
              <Link href={`/register${currentTenant ? `?club=${currentTenant.slug}` : ""}`}>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-xs gap-1.5"
                >
                  <Sparkles className="w-3 h-3" />
                  Registrieren
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation for Clubs */}
      {currentTenant && (
        <div className="md:hidden flex items-center justify-around border-t border-border px-2 py-1.5 bg-background/90 dark:bg-background/95 backdrop-blur-md">
          <Link
            href={`/c/${currentTenant.slug}`}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
              pathname === `/c/${currentTenant.slug}`
                ? "bg-card dark:bg-accent text-clay dark:text-clay-hover shadow-xs"
                : "text-muted-foreground"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-clay" />
            Kalender
          </Link>

          {user && (
            <Link
              href={`/c/${currentTenant.slug}/bookings`}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                pathname.includes("/bookings")
                  ? "bg-card dark:bg-accent text-clay dark:text-clay-hover shadow-xs"
                  : "text-muted-foreground"
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              Meine Buchungen
            </Link>
          )}

          {isTenantAdmin && (
            <Link
              href={`/c/${currentTenant.slug}/admin`}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                pathname.includes("/admin")
                  ? "bg-card dark:bg-accent text-amber-600 dark:text-amber-400 shadow-xs"
                  : "text-muted-foreground"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              Admin
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
