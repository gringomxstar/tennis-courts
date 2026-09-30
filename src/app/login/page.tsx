"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginWithCredentials } from "@/app/actions/auth";
import { Spinner } from "@/components/app/avatar";

const input = "h-12 w-full rounded-[14px] bg-bg px-4 text-[15px] text-ink outline-none focus:shadow-[inset_0_0_0_2px_var(--brand-deep)]";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginWithCredentials, undefined);

  const bad = state?.error ? " shadow-[inset_0_0_0_2px_var(--bad)]" : "";
  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-col gap-4 px-5 pb-[max(40px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <Link href="/" className="flex items-center gap-2.5 text-[17px] font-bold">
        <i className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] bg-brand-deep text-[13px] font-extrabold not-italic text-white">TC</i>
        TC Marly
      </Link>
      <h1 className="mt-4 text-[36px] font-bold leading-none tracking-[-.04em]">Anmelden</h1>

      <form action={formAction} className="card flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
          E-Mail
          <input name="email" type="email" autoComplete="email" required className={input + bad} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
          Passwort
          <input name="password" type="password" autoComplete="current-password" required className={input + bad} />
          {state?.error && <span role="alert" className="text-[12.5px] font-semibold text-bad">{state.error}</span>}
        </label>
        <button type="submit" disabled={isPending} className="btn btn-pri h-[54px] w-full text-[16px]">
          {isPending && <Spinner />}
          Anmelden
        </button>
      </form>

      <Link href="/" className="btn h-[54px] w-full text-[16px]">
        Ohne Konto als Gast buchen
      </Link>
      <p className="text-center text-[14px] text-ink-2">
        Noch kein Konto?{" "}
        <Link href="/register" className="font-semibold text-brand-deep">
          Registrieren
        </Link>
      </p>
    </main>
  );
}
