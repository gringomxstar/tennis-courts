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
    optimisticBalance !== null ? optimisticBalance : (wallet?.balance ?? 50);

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-white/[0.06] bg-white/85 dark:bg-[#0B0F17]/90 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Tenant Info */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#E25B36] via-[#D84C25] to-[#B33816] flex items-center justify-center text-white shadow-md shadow-[#E25B36]/25 group-hover:scale-105 group-hover:shadow-[#E25B36]/35 transition-all">
              <span className="text-xl">🎾</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                  Tennis<span className="text-[#E25B36]">Courts</span>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-[#E25B36]/15 text-[#E25B36] dark:bg-[#E25B36]/20 dark:text-[#F37957] rounded border border-[#E25B36]/25">
                  Nocturne
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Grand Slam OS</span>
            </div>
          </Link>

          {currentTenant && (
            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-800">
              <Link
                href={`/c/${currentTenant.slug}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-[#141A26] hover:bg-[#E25B36]/10 hover:text-[#E25B36] dark:hover:bg-[#1A2232] dark:hover:text-[#F37957] transition-colors border border-transparent dark:border-white/[0.04]"
              >
                <MapPin className="w-3.5 h-3.5 text-[#E25B36]" />
                <span>{currentTenant.name}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Center: Navigation Links inside Club */}
        {currentTenant && (
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-100/70 dark:bg-[#141A26]/80 rounded-xl border border-slate-200/50 dark:border-white/[0.06]">
            <Link href={`/c/${currentTenant.slug}`}>
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  pathname === `/c/${currentTenant.slug}`
                    ? "bg-white dark:bg-[#1C2536] text-[#E25B36] dark:text-[#F37957] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-[#E25B36]" />
                Kalender
              </button>
            </Link>

            {user && (
              <Link href={`/c/${currentTenant.slug}/bookings`}>
                <button
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    pathname.includes("/bookings")
                      ? "bg-white dark:bg-[#1C2536] text-[#E25B36] dark:text-[#F37957] shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                      ? "bg-white dark:bg-[#1C2536] text-amber-600 dark:text-amber-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400"
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
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 dark:bg-[#141A26] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold shadow-2xs">
              <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">
                {currentBalance.toFixed(0)} CHF
              </span>
              <button
                onClick={handleTopUp}
                disabled={topUpLoading}
                title="1-Klick Dev/Test: +50 CHF Guthaben aufladen"
                className="ml-1 px-1.5 py-0.5 rounded bg-[#E25B36] hover:bg-[#C84B2B] text-white text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
              >
                {topUpLoading ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  "+50"
                )}
              </button>
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
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
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
                  className="h-8 px-2.5 text-xs text-slate-600 hover:text-rose-600 border-slate-200 dark:border-slate-800"
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
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 dark:border-white/[0.06] px-2 py-1.5 bg-slate-50/90 dark:bg-[#0B0F17]/95 backdrop-blur-md">
          <Link
            href={`/c/${currentTenant.slug}`}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
              pathname === `/c/${currentTenant.slug}`
                ? "bg-white dark:bg-[#1C2536] text-[#E25B36] dark:text-[#F37957] shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#E25B36]" />
            Kalender
          </Link>

          {user && (
            <Link
              href={`/c/${currentTenant.slug}/bookings`}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                pathname.includes("/bookings")
                  ? "bg-white dark:bg-[#1C2536] text-[#E25B36] dark:text-[#F37957] shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
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
                  ? "bg-white dark:bg-[#1C2536] text-amber-600 dark:text-amber-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
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
