"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginWithCredentials, quickDemoLogin } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ShieldCheck, UserCheck, Sparkles, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginWithCredentials, undefined);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const handleQuickDemo = async (email: string) => {
    setDemoLoading(email);
    await quickDemoLogin(email);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 group mb-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
            🎾
          </div>
          <span className="font-bold text-2xl tracking-tight text-slate-900 dark:text-white">
            TennisCourts
          </span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Im Tennisclub anmelden
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Reserviere Plätze, verwalte Matches und organisiere deinen Club
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Quick Demo Login Box */}
        <Card className="mb-6 border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/40 dark:border-emerald-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              1-Klick Demo Login
            </CardTitle>
            <CardDescription className="text-xs text-emerald-700 dark:text-emerald-300">
              Wähle eine vordefinierte Rolle zum sofortigen Ausprobieren:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between bg-white text-xs hover:bg-emerald-100 dark:bg-slate-900"
              onClick={() => handleQuickDemo("roger@tc-rotweiss.ch")}
              disabled={Boolean(demoLoading)}
            >
              <span className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Roger Federer
              </span>
              <Badge className="bg-emerald-600 text-[10px]">Mitglied</Badge>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between bg-white text-xs hover:bg-amber-100 dark:bg-slate-900"
              onClick={() => handleQuickDemo("clubadmin@tc-rotweiss.ch")}
              disabled={Boolean(demoLoading)}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Marc Rosset
              </span>
              <Badge className="bg-amber-600 text-[10px]">Club Admin</Badge>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between bg-white text-xs hover:bg-purple-100 dark:bg-slate-900"
              onClick={() => handleQuickDemo("admin@tennisapp.ch")}
              disabled={Boolean(demoLoading)}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                Plattform Administrator
              </span>
              <Badge className="bg-purple-600 text-[10px]">Super Admin</Badge>
            </Button>
          </CardContent>
        </Card>

        {/* Regular Login Form */}
        <Card>
          <CardContent className="pt-6">
            <form action={formAction} className="space-y-4">
              {state?.error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{state.error}</span>
                </div>
              )}

              <div>
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="roger@tc-rotweiss.ch"
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Passwort</Label>
                  <span className="text-xs text-slate-500">Demo PW: tennis12345</span>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="mt-1.5"
                />
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Anmelden
              </Button>
            </form>

            <div className="mt-6 pt-4 text-center border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              Noch kein Konto?{" "}
              <Link
                href="/register"
                className="font-semibold text-emerald-600 hover:text-emerald-700 underline-offset-2 hover:underline"
              >
                Jetzt Club-Mitglied werden
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
