"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/app/actions/auth";
import { Spinner } from "@/components/app/avatar";

const input = "h-12 w-full rounded-[14px] bg-bg px-4 text-[15px] text-ink outline-none focus:shadow-[inset_0_0_0_2px_var(--brand-deep)]";

export function SetPasswordForm({ slug, u, e, t, email }: { slug: string; u: string; e: string; t: string; email: string }) {
  const [state, formAction, isPending] = useActionState(setPasswordAction, undefined);
  return (
    <form action={formAction} className="card flex flex-col gap-3.5 p-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="u" value={u} />
      <input type="hidden" name="e" value={e} />
      <input type="hidden" name="t" value={t} />
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <label htmlFor="new-password" className="text-[13px] font-semibold text-ink-2">Neues Passwort</label>
      <input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={6}
        required
        className={`${input} ${state?.error ? "shadow-[inset_0_0_0_2px_var(--bad)]" : ""}`}
      />
      {state?.error ? <span role="alert" className="-mt-2 text-[12.5px] font-semibold text-bad">{state.error}</span> : <span className="-mt-2 text-[12.5px] text-ink-3">mindestens 6 Zeichen</span>}
      <button
        type="submit"
        disabled={isPending}
        className="btn btn-pri h-[54px] w-full text-[16px]"
      >
        {isPending && <Spinner />}
        Passwort setzen
      </button>
    </form>
  );
}
