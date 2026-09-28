"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerUserAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerUserAction, undefined);

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 group mb-4">
          <div className="h-10 w-10 rounded-xl bg-clay flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
            🎾
          </div>
          <span className="font-bold text-2xl tracking-tight text-foreground">
            TennisCourts
          </span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Neues Mitgliedskonto erstellen
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Wähle deinen Tennisclub und starte direkt mit Platzbuchungen
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card>
          <CardContent className="pt-6">
            <form action={formAction} className="space-y-4">
              {state?.error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{state.error}</span>
                </div>
              )}

              {/* Club Selection */}
              <div>
                <Label htmlFor="tenantSlug">Tennisclub wählen</Label>
                <select
                  id="tenantSlug"
                  name="tenantSlug"
                  defaultValue="tc-rot-weiss"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-clay dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="tc-rot-weiss">TC Rot-Weiss Zürich</option>
                  <option value="tc-obersee">Tennis Club Obersee</option>
                </select>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">Vorname</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Roger"
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nachname</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Federer"
                    required
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@beispiel.ch"
                  required
                  className="mt-1.5"
                />
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone">Telefonnummer (optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+41 79 000 00 00"
                  className="mt-1.5"
                />
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password">Passwort (min. 6 Zeichen)</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  minLength={6}
                  required
                  className="mt-1.5"
                />
              </div>

              <Button type="submit" className="w-full gap-2 mt-2" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Registrieren & Beitreten
              </Button>
            </form>

            <div className="mt-6 pt-4 text-center border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              Bereits registriert?{" "}
              <Link
                href="/login"
                className="font-semibold text-clay hover:text-clay-hover underline-offset-2 hover:underline"
              >
                Hier anmelden
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
