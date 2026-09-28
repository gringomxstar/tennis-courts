"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginWithCredentials, logoutAction, registerUserAction } from "@/app/actions/auth";
import { topUpWalletAction } from "@/app/actions/booking";
import { Segmented } from "@/components/app/segmented";
import { SwitchKnob } from "@/components/app/switch";
import { Sheet } from "@/components/app/sheet";
import { Spinner } from "@/components/app/avatar";
import { initials } from "@/lib/courts";
import type { MembershipPlan } from "@/types";

const card = "rounded-[26px] border border-border bg-card";
const label = "text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input = "h-[50px] rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none";
const row = "flex w-full items-center gap-3.5 rounded-[22px] border border-border bg-card px-5 py-4 text-left";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const subscribeTheme = (cb: () => void) => {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => o.disconnect();
};

export function ProfileView({
  slug,
  clubName,
  user,
  canAdmin,
  admin,
  openAbo,
  wallet,
  plans,
  membership,
}: {
  slug: string;
  clubName: string;
  user: { name: string } | null;
  canAdmin: boolean;
  admin: boolean;
  openAbo: boolean;
  wallet: number;
  plans: MembershipPlan[];
  membership: { planId: string; name: string; price: number; validity: string } | null;
}) {
  const router = useRouter();
  const club = clubName.replace(/^Tennis Club /, "TC ");
  const member = !!user && !admin;
  const me = !user
    ? { ini: "G", name: "Gast", sub: "Nicht angemeldet" }
    : { ini: initials(user.name), name: user.name, sub: `${admin ? "Club-Admin" : "Mitglied"} · ${club}` };

  // --- guest login / register
  const [register, setRegister] = useState(false);
  const [, authAction, authPending] = useActionState(async (prev: { error?: string } | undefined, fd: FormData) => {
    let res: { error?: string } | undefined;
    if (register) {
      const [first = "", ...rest] = String(fd.get("name") ?? "").trim().split(/\s+/);
      fd.set("firstName", first);
      fd.set("lastName", rest.join(" "));
      res = await registerUserAction(prev, fd);
    } else {
      res = await loginWithCredentials(prev, fd);
    }
    if (res?.error) toast(res.error);
    return res;
  }, undefined);

  // --- wallet
  const [balance, setBalance] = useState(wallet);
  async function topUp(v: number) {
    const res = await topUpWalletAction({ clubSlug: slug, amount: v });
    if (!res.success) return void toast(res.error ?? "Aufladen fehlgeschlagen");
    if (typeof res.balance === "number") setBalance(res.balance);
    toast(`CHF ${v} aufgeladen`);
  }

  // --- Abo sheet
  const [sheetOpen, setSheetOpen] = useState(openAbo && member);
  const [sel, setSel] = useState(membership?.planId ?? plans[0]?.id);
  const [paying, setPaying] = useState(false);
  const sp = plans.find((p) => p.id === sel);
  function openPlans() {
    setSel(membership?.planId ?? plans[0]?.id);
    setSheetOpen(true);
  }
  async function payPlan() {
    if (!sp || paying) return;
    if (!sp.price) return setSheetOpen(false); // free plan: nothing to charge
    setPaying(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: sp.id, paymentMethod: "STRIPE" }),
      });
      const j: { url?: string; error?: string } = await r.json();
      if (j.url) {
        window.location.assign(j.url);
        return;
      }
      toast(j.error ?? "Zahlung fehlgeschlagen");
    } catch {
      toast("Zahlung fehlgeschlagen");
    }
    setPaying(false);
  }

  // --- theme (same storage as ThemeToggle / the root layout script)
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.classList.contains("dark"), () => true);
  function toggleDark() {
    const next = !dark;
    const el = document.documentElement;
    el.classList.toggle("dark", next);
    el.classList.toggle("light", !next);
    el.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("tennis-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <>
      <div className="flex items-center gap-3.5 px-5 pt-[66px] lg:pt-12">
        <div
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#e25b36,#b33816)] text-[22px] font-bold text-white"
        >
          {me.ini}
        </div>
        <div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">{me.name}</h1>
          <div className="text-[15px] text-muted-foreground">{me.sub}</div>
        </div>
      </div>

      {canAdmin && user && (
        <Segmented
          className="mx-5 mt-[18px] lg:max-w-md"
          label="Rolle"
          options={[["member", "Mitglied"], ["admin", "Club-Admin"]] as const}
          value={admin ? "admin" : "member"}
          onChange={(v) => router.push(v === "admin" ? `/c/${slug}/admin` : `/c/${slug}/profile`)}
        />
      )}

      {!user && (
        <>
          <form action={authAction} className={`${card} mx-5 mt-4 p-5 lg:max-w-[480px]`}>
            <h2 className="text-[22px] font-bold tracking-[-.02em]">{register ? "Konto erstellen" : "Anmelden"}</h2>
            <input type="hidden" name="callbackUrl" value={`/c/${slug}`} />
            <input type="hidden" name="tenantSlug" value={slug} />
            <div className="mt-[14px] flex flex-col gap-2.5">
              {register && (
                <input name="name" required autoComplete="name" aria-label="Vor- und Nachname" placeholder="Vor- und Nachname" className={input} />
              )}
              <input name="email" type="email" required autoComplete="email" aria-label="E-Mail" placeholder="E-Mail" className={input} />
              <input
                name="password"
                type="password"
                required
                autoComplete={register ? "new-password" : "current-password"}
                aria-label="Passwort"
                placeholder="Passwort"
                className={input}
              />
            </div>
            <button
              type="submit"
              disabled={authPending}
              className="mt-[14px] flex h-[54px] w-full items-center justify-center rounded-[17px] bg-clay text-[17px] font-bold text-white"
            >
              {register ? "Registrieren" : "Anmelden"}
            </button>
            <button
              type="button"
              onClick={() => setRegister(!register)}
              className="mt-3 w-full text-center text-[15px] font-semibold text-clay-text"
            >
              {register ? "Schon Mitglied? Anmelden" : "Neu hier? Registrieren"}
            </button>
          </form>
          <div className="mx-5 mt-3 rounded-[22px] bg-inset px-[18px] py-4 text-[15px] leading-[1.45] text-muted-foreground lg:max-w-[480px]">
            Als Gast zahlst du pro Platz mit Twint. Mit einem Abo ist Spielen inklusive.
          </div>
        </>
      )}

      <div className="lg:grid lg:grid-cols-2">
      {member && (
        <>
          <div className={`${card} mx-5 mt-4 p-5`}>
            <div className="flex items-baseline justify-between">
              <div className={label}>Guthaben</div>
              <div className="flex items-center gap-[5px] text-[13px] font-semibold text-muted-foreground">
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4" />
                </svg>
                für Flutlicht
              </div>
            </div>
            <div className="mt-1 text-[52px] font-bold leading-[1.1] tracking-[-.045em]">
              <span className="text-[22px] tracking-normal text-muted-foreground">CHF </span>
              {fmt(balance)}
            </div>
            <div className="mt-[14px] flex gap-2">
              {[20, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-label={`CHF ${v} aufladen`}
                  onClick={() => topUp(v)}
                  className="flex h-11 flex-1 items-center justify-center rounded-[14px] bg-inset text-[15px] font-bold active:scale-[.94]"
                >
                  + {v}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 pt-3 lg:flex lg:pt-4">
            <button type="button" onClick={openPlans} className={`${card} flex w-full items-center gap-3.5 p-5 text-left`}>
              <div className="flex-1">
                <div className={label}>Abo</div>
                <div className="mt-[3px] text-[22px] font-bold tracking-[-.02em]">{membership?.name ?? "Kein Abo"}</div>
                {membership && (
                  <div className="mt-px text-[14px] text-muted-foreground">
                    {membership.validity} · CHF {fmt(membership.price)}
                  </div>
                )}
              </div>
              <div className="rounded-[12px] bg-inset px-[14px] py-[9px] text-[14px] font-bold text-clay-text">Ändern</div>
            </button>
          </div>
        </>
      )}

      <div className="px-5 pt-3">
        <button type="button" aria-pressed={dark} onClick={toggleDark} className={row}>
          <span className="flex-1 text-[17px] font-semibold">{dark ? "Nocturne · Dunkel" : "Tag · Hell"}</span>
          <SwitchKnob on={dark} />
        </button>
      </div>

      {user && (
        <form action={logoutAction} className="px-5 pt-3">
          <button type="submit" className={row}>
            <span className="flex-1 text-[17px] font-semibold text-muted-foreground">Abmelden</span>
          </button>
        </form>
      )}
      </div>

      {member && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Abo wählen">
          <div className="text-[28px] font-bold tracking-[-.03em]">Abo wählen</div>
          <div className="mt-[14px] flex flex-col gap-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === sel}
                onClick={() => setSel(p.id)}
                className={`flex w-full items-center gap-3 rounded-[18px] border-2 bg-card px-4 py-3 text-left transition-[border-color] duration-[250ms] ${
                  p.id === sel ? "border-clay" : "border-border"
                }`}
              >
                <div className="flex-1">
                  <div className="text-[16px] font-bold">{p.name}</div>
                  <div className="text-[13px] text-muted-foreground">{p.description}</div>
                </div>
                <div className="text-[17px] font-bold">CHF {fmt(p.price)}</div>
              </button>
            ))}
          </div>
          {sp && (
            <button
              type="button"
              onClick={payPlan}
              className="mt-4 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[20px] bg-clay text-[18px] font-bold text-white active:scale-[.97]"
            >
              {paying && <Spinner />}
              {paying ? "Twint…" : sp.price ? `Mit Twint bezahlen · CHF ${fmt(sp.price)}` : "Gast-Pass wählen"}
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}
