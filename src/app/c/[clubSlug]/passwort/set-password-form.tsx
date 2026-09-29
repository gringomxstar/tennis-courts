"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/app/actions/auth";
import { Spinner } from "@/components/app/avatar";

const input = "h-[50px] w-full rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";

export function SetPasswordForm({ slug, u, e, t, email }: { slug: string; u: string; e: string; t: string; email: string }) {
  const [state, formAction, isPending] = useActionState(setPasswordAction, undefined);
  return (
    <form action={formAction} className="mt-7 flex flex-col gap-2.5">
      {state?.error && (
        <div role="alert" className="rounded-[15px] bg-inset px-4 py-3 text-[15px] font-semibold text-clay-text">
          {state.error}
        </div>
      )}
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="u" value={u} />
      <input type="hidden" name="e" value={e} />
      <input type="hidden" name="t" value={t} />
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <label htmlFor="new-password" className="sr-only">Neues Passwort</label>
      <input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={6}
        required
        placeholder="Neues Passwort (mind. 6 Zeichen)"
        className={input}
      />
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 flex h-[56px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-clay text-[17px] font-bold text-white disabled:opacity-70"
      >
        {isPending && <Spinner />}
        Passwort setzen
      </button>
    </form>
  );
}
