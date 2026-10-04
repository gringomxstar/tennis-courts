"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { quickDemoLogin, signOutToClubAction } from "@/app/actions/auth";
import { Sheet } from "@/components/app/sheet";

export type DemoPersona = { email: string | null; label: string; name: string };

/** Demo mode only: a small pill (top right) that switches between the fixed test personas. */
export function DemoSwitcher({ slug, personas, current }: { slug: string; personas: DemoPersona[]; current: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const pathname = usePathname();

  function pick(p: DemoPersona) {
    if (p.email === current) return setOpen(false);
    setBusy(p.label);
    start(async () => {
      const res = p.email ? await quickDemoLogin(p.email, slug, pathname) : await signOutToClubAction(slug);
      if (res?.error) toast(res.error);
      setBusy(null);
    });
  }

  return (
    <>
      <div className="fixed right-4 top-[max(12px,env(safe-area-inset-top))] z-40 flex items-center gap-2 @min-[640px]:bottom-[132px] @min-[640px]:left-[22px] @min-[640px]:right-auto @min-[640px]:top-auto">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Rolle wechseln"
          className="relative h-[30px] rounded-full border border-border bg-glass px-3 text-[13px] before:absolute before:-inset-x-1 before:-inset-y-[7px] before:content-[''] font-bold text-clay-text backdrop-blur-[24px]"
        >
          <span className="@min-[640px]:hidden">Demo · {personas.find((p) => p.email === current)?.label ?? "Konto"}</span>
          <span className="hidden @min-[640px]:inline">Demo</span>
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen} title="Rolle wechseln">
        <h2 className="text-[26px] font-bold tracking-[-.03em]">Rolle wechseln</h2>
        <p className="mt-0.5 text-[14px] text-muted-foreground">Demo-Modus – Buchungen sind Testdaten.</p>
        <div className="mt-4 flex flex-col gap-2">
          {personas.map((p) => {
            const on = p.email === current;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => pick(p)}
                disabled={pending}
                aria-current={on || undefined}
                className={`flex w-full items-center gap-3 rounded-[18px] border bg-card px-4 py-3.5 text-left disabled:opacity-60 ${on ? "border-clay" : "border-border"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">{p.label}</span>
                  <span className="block text-[14px] text-muted-foreground">{p.name}</span>
                </span>
                {busy === p.label ? (
                  <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-[3px] border-border border-t-clay" />
                ) : (
                  on && <span className="text-[13px] font-bold text-clay-text">Aktiv</span>
                )}
              </button>
            );
          })}
        </div>
        <Link href="/fuer-clubs" className="mt-3 flex min-h-[44px] items-center justify-center text-[15px] font-bold text-clay-text">
          Alle Funktionen für Clubs →
        </Link>
      </Sheet>
    </>
  );
}
