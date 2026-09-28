"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginWithCredentials, quickDemoLogin } from "@/app/actions/auth";
import { Avatar, Chevron, Spinner } from "@/components/app/avatar";

const label = "text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input = "h-[50px] w-full rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";

const DEMOS = [
  { email: "member@marly.ch", ini: "RF", name: "Roger Federer", role: "Mitglied" },
  { email: "clubadmin@marly.ch", ini: "MR", name: "Marc Rosset", role: "Club-Admin" },
  { email: "admin@tennisapp.ch", ini: "PA", name: "Plattform-Administrator", role: "Super-Admin" },
];

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginWithCredentials, undefined);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const handleQuickDemo = async (email: string) => {
    setDemoLoading(email);
    await quickDemoLogin(email);
  };

  return (
    <main className="mx-auto w-full max-w-[440px] px-5 pb-[max(40px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <Link href="/" className="text-[20px] font-bold tracking-[-.03em]">
        TC Marly
      </Link>
      <h1 className="mt-12 text-[48px] font-bold leading-none tracking-[-.045em]">Anmelden</h1>

      <form action={formAction} className="mt-7 flex flex-col gap-2.5">
        {state?.error && (
          <div role="alert" className="rounded-[15px] bg-inset px-4 py-3 text-[15px] font-semibold text-clay-text">
            {state.error}
          </div>
        )}
        <label htmlFor="email" className="sr-only">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="E-Mail" required className={input} />
        <label htmlFor="password" className="sr-only">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Passwort" required className={input} />
        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex h-[56px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-clay text-[17px] font-bold text-white disabled:opacity-70"
        >
          {isPending && <Spinner />}
          Anmelden
        </button>
      </form>

      <p className="mt-5 text-center text-[15px] text-muted-foreground">
        Noch kein Konto?{" "}
        <Link href="/register" className="font-semibold text-clay-text">
          Registrieren
        </Link>
      </p>

      <div className="mt-12 flex items-baseline justify-between">
        <div className={label}>Demo-Zugänge</div>
        <div className="text-[13px] text-muted-foreground">Ein Tap meldet dich an</div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {DEMOS.map((d) => (
          <button
            key={d.email}
            type="button"
            onClick={() => handleQuickDemo(d.email)}
            disabled={Boolean(demoLoading)}
            className="flex w-full items-center gap-3.5 rounded-[22px] border border-border bg-card px-4 py-3.5 text-left disabled:opacity-60"
          >
            <Avatar ini={d.ini} />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold">{d.name}</span>
              <span className="block text-[14px] text-muted-foreground">{d.role}</span>
            </span>
            {demoLoading === d.email ? (
              <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-[3px] border-border border-t-clay" />
            ) : (
              <Chevron />
            )}
          </button>
        ))}
      </div>
    </main>
  );
}
