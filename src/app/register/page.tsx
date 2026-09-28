"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerUserAction } from "@/app/actions/auth";
import { Chevron, Spinner } from "@/components/app/avatar";

const label = "mb-1.5 block text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input = "h-[50px] w-full rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerUserAction, undefined);

  return (
    <main className="mx-auto w-full max-w-[440px] px-5 pb-[max(40px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <Link href="/" className="text-[20px] font-bold tracking-[-.03em]">
        TC Marly
      </Link>
      <h1 className="mt-12 text-[48px] font-bold leading-none tracking-[-.045em]">
        Konto
        <br />
        erstellen
      </h1>

      <form action={formAction} className="mt-7 flex flex-col gap-4">
        {state?.error && (
          <div role="alert" className="rounded-[15px] bg-inset px-4 py-3 text-[15px] font-semibold text-clay-text">
            {state.error}
          </div>
        )}

        <div className="relative">
          <label htmlFor="tenantSlug" className={label}>Club</label>
          <select id="tenantSlug" name="tenantSlug" defaultValue="tc-marly" className={`${input} appearance-none`}>
            <option value="tc-marly">Tennis Club Marly</option>
            <option value="tc-rot-weiss">TC Rot-Weiss Zürich</option>
            <option value="tc-obersee">Tennis Club Obersee</option>
          </select>
          <Chevron className="pointer-events-none absolute bottom-4 right-4 rotate-90" />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="firstName" className={label}>Vorname</label>
            <input id="firstName" name="firstName" type="text" autoComplete="given-name" required className={input} />
          </div>
          <div>
            <label htmlFor="lastName" className={label}>Nachname</label>
            <input id="lastName" name="lastName" type="text" autoComplete="family-name" required className={input} />
          </div>
        </div>

        <div>
          <label htmlFor="email" className={label}>E-Mail</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@beispiel.ch" required className={input} />
        </div>

        <div>
          <label htmlFor="phone" className={label}>Telefon (optional)</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+41 79 000 00 00" className={input} />
        </div>

        <div>
          <label htmlFor="password" className={label}>Passwort (min. 6 Zeichen)</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required className={input} />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex h-[56px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-clay text-[17px] font-bold text-white disabled:opacity-70"
        >
          {isPending && <Spinner />}
          Konto erstellen
        </button>
      </form>

      <p className="mt-5 text-center text-[15px] text-muted-foreground">
        Schon registriert?{" "}
        <Link href="/login" className="font-semibold text-clay-text">
          Anmelden
        </Link>
      </p>
    </main>
  );
}
