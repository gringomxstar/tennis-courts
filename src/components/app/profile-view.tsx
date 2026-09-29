"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginWithCredentials, logoutAction, registerUserAction, requestPasswordLinkAction } from "@/app/actions/auth";
import { topUpWalletAction } from "@/app/actions/booking";
import { updateProfileAction } from "@/app/actions/profile";
import { Segmented } from "@/components/app/segmented";
import { SwitchKnob } from "@/components/app/switch";
import { Spinner } from "@/components/app/avatar";
import { initials } from "@/lib/courts";

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
  next,
  openRegister,
  wallet,
  membership,
  profile,
  support,
  clubs,
}: {
  slug: string;
  clubName: string;
  user: { name: string } | null;
  canAdmin: boolean;
  admin: boolean;
  /** Safe local path to return to after login/signup, e.g. the Abo page. */
  next?: string;
  openRegister?: boolean;
  wallet: number;
  membership: { name: string; price: number; validity: string } | null;
  profile: { firstName: string; lastName: string; phone: string } | null;
  support: { email?: string | null; phone?: string | null };
  clubs: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const club = clubName.replace(/^Tennis Club /, "TC ");
  const member = !!user && !admin;
  const me = !user
    ? { ini: "G", name: "Gast", sub: "Nicht angemeldet" }
    : { ini: initials(user.name), name: user.name, sub: `${admin ? "Club-Admin" : "Mitglied"} · ${club}` };

  // --- guest login / register
  const [register, setRegister] = useState(!!openRegister);
  const [forgot, setForgot] = useState(false);
  const [linkState, linkAction, linkPending] = useActionState(requestPasswordLinkAction, undefined);
  const [authState, authAction, authPending] = useActionState(async (prev: { error?: string } | undefined, fd: FormData) => {
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
    // React resets the form after the action; hand the typed values back as defaultValue (password stays empty)
    return { ...res, name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "") };
  }, undefined);

  // --- wallet (paid through Stripe Checkout, credited on return / by the webhook)
  const [topping, setTopping] = useState<number | null>(null);
  async function topUp(v: number) {
    if (topping) return;
    setTopping(v);
    const res = await topUpWalletAction({ clubSlug: slug, amount: v }).catch(() => null);
    if (res?.success && res.checkoutUrl) return window.location.assign(res.checkoutUrl);
    setTopping(null);
    toast(res?.error ?? "Aufladen fehlgeschlagen");
  }

  // --- profile
  const [editing, setEditing] = useState(false);
  const [, profileAction, profilePending] = useActionState(async (_: unknown, fd: FormData) => {
    const res = await updateProfileAction(slug, {
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
    });
    toast(res.success ? "Profil gespeichert" : (res.error ?? "Speichern fehlgeschlagen"));
    if (res.success) {
      setEditing(false);
      router.refresh();
    }
    return res;
  }, undefined);

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
            <h2 className="text-[22px] font-bold tracking-[-.02em]">{register ? (next?.includes("/abos") ? "Konto erstellen, dann Abo zahlen." : "Konto erstellen") : "Anmelden"}</h2>
            <input type="hidden" name="callbackUrl" value={next ?? `/c/${slug}`} />
            <input type="hidden" name="tenantSlug" value={slug} />
            <div className="mt-[14px] flex flex-col gap-2.5">
              {register && (
                <input name="name" required defaultValue={authState?.name} autoComplete="name" aria-label="Vor- und Nachname" placeholder="Vor- und Nachname" className={input} />
              )}
              <input name="email" type="email" required defaultValue={authState?.email} autoComplete="email" aria-label="E-Mail" placeholder="E-Mail" className={input} />
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
            {!register && !forgot && (
              <button type="button" onClick={() => setForgot(true)} className="mt-2 w-full text-center text-[15px] font-semibold text-muted-foreground">
                Konto aktivieren / Passwort vergessen?
              </button>
            )}
          </form>
          {!register && forgot && (
            <form action={linkAction} className={`${card} mx-5 mt-3 p-5 lg:max-w-[480px]`}>
              <div className={label}>Konto aktivieren / Passwort vergessen</div>
              {linkState?.ok ? (
                <div role="status" className="mt-2 text-[15px] leading-[1.45] text-muted-foreground">
                  Falls ein Konto existiert, haben wir dir einen Link geschickt.
                </div>
              ) : (
                <>
                  <input type="hidden" name="tenantSlug" value={slug} />
                  <input name="email" type="email" required autoComplete="email" aria-label="E-Mail" placeholder="E-Mail" className={`${input} mt-3 w-full`} />
                  {linkState?.error && <div className="mt-2 text-[14px] font-semibold text-clay-text">{linkState.error}</div>}
                  <button
                    type="submit"
                    disabled={linkPending}
                    className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-inset text-[16px] font-bold text-clay-text"
                  >
                    {linkPending && <Spinner />}Link senden
                  </button>
                </>
              )}
            </form>
          )}
          <div className="mx-5 mt-3 rounded-[22px] bg-inset px-[18px] py-4 text-[15px] leading-[1.45] text-muted-foreground lg:max-w-[480px]">
            Als Gast zahlst du pro Platz online. Mit einem Abo ist Spielen inklusive.
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
              {fmt(wallet)}
            </div>
            <div className="mt-[14px] flex gap-2">
              {[20, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-label={`CHF ${v} aufladen`}
                  onClick={() => topUp(v)}
                  disabled={topping !== null}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-inset text-[15px] font-bold active:scale-[.94]"
                >
                  {topping === v && <Spinner />}+ {v}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 pt-3 lg:flex lg:pt-4">
            <Link href={`/c/${slug}/abos`} className={`${card} flex w-full items-center gap-3.5 p-5 text-left`}>
              <div className="flex-1">
                <div className={label}>Abo</div>
                <div className="mt-[3px] text-[22px] font-bold tracking-[-.02em]">{membership?.name ?? "Kein Abo"}</div>
                {membership && (
                  <div className="mt-px text-[14px] text-muted-foreground">
                    {membership.validity} · CHF {fmt(membership.price)}
                  </div>
                )}
              </div>
              <div className="rounded-[12px] bg-inset px-[14px] py-[9px] text-[14px] font-bold text-clay-text">{membership ? "Ändern" : "Ansehen"}</div>
            </Link>
          </div>
        </>
      )}

      {profile && (
        <div className="px-5 pt-3">
          {editing ? (
            <form action={profileAction} className={`${card} p-5`}>
              <div className={label}>Meine Daten</div>
              <div className="mt-3 flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                  <input name="firstName" required defaultValue={profile.firstName} aria-label="Vorname" placeholder="Vorname" autoComplete="given-name" className={`${input} min-w-0 flex-1`} />
                  <input name="lastName" required defaultValue={profile.lastName} aria-label="Nachname" placeholder="Nachname" autoComplete="family-name" className={`${input} min-w-0 flex-1`} />
                </div>
                <input name="phone" type="tel" defaultValue={profile.phone} aria-label="Telefon" placeholder="Telefon" autoComplete="tel" className={input} />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setEditing(false)} className="h-12 flex-1 rounded-[15px] bg-inset text-[16px] font-bold">
                  Abbrechen
                </button>
                <button type="submit" disabled={profilePending} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[15px] bg-clay text-[16px] font-bold text-white">
                  {profilePending && <Spinner />}Speichern
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className={row}>
              <span className="flex-1">
                <span className="block text-[17px] font-semibold">Meine Daten</span>
                <span className="block text-[14px] text-muted-foreground">
                  {`${profile.firstName} ${profile.lastName}`.trim()}
                  {profile.phone ? ` · ${profile.phone}` : ""}
                </span>
              </span>
              <span className="text-[14px] font-bold text-clay-text">Bearbeiten</span>
            </button>
          )}
        </div>
      )}

      {clubs.length > 1 && (
        <div className="px-5 pt-3">
          <div className={`${card} p-5`}>
            <div className={label}>Club wechseln</div>
            <div className="mt-2.5 flex flex-col gap-2">
              {clubs.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  aria-current={c.slug === slug}
                  onClick={() => router.push(`/c/${c.slug}`)}
                  className={`flex h-12 items-center justify-between rounded-[15px] px-4 text-[16px] font-semibold ${c.slug === slug ? "bg-clay text-white" : "bg-inset"}`}
                >
                  {c.name}
                  {c.slug === slug && <span className="text-[13px] font-bold">Aktiv</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(support.email || support.phone) && (
        <div className="px-5 pt-3">
          <div className={`${card} p-5`}>
            <div className={label}>Hilfe &amp; Kontakt</div>
            <div className="mt-1 text-[15px] text-muted-foreground">Fragen zu Buchungen oder deinem Abo? Der Club hilft dir weiter.</div>
            <div className="mt-3 flex gap-2">
              {support.email && (
                <a href={`mailto:${support.email}`} className="flex h-12 flex-1 items-center justify-center rounded-[15px] bg-inset text-[15px] font-bold text-clay-text">
                  E-Mail
                </a>
              )}
              {support.phone && (
                <a href={`tel:${support.phone.replace(/\s+/g, "")}`} className="flex h-12 flex-1 items-center justify-center rounded-[15px] bg-inset text-[15px] font-bold text-clay-text">
                  Anrufen
                </a>
              )}
            </div>
          </div>
        </div>
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
    </>
  );
}
