"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginWithCredentials, logoutAction, registerUserAction, requestPasswordLinkAction } from "@/app/actions/auth";
import { topUpWalletAction } from "@/app/actions/booking";
import { updateProfileAction } from "@/app/actions/profile";
import { SwitchKnob } from "@/components/app/switch";
import { Avatar, Chevron, Spinner } from "@/components/app/avatar";
import { initials } from "@/lib/courts";

const label = "text-[13px] font-bold uppercase tracking-[.06em] text-ink-3";
const fld = "h-12 w-full min-w-0 rounded-[14px] bg-bg px-4 text-[15px] text-ink outline-none focus:shadow-[inset_0_0_0_2px_var(--brand-deep)]";
const row = "flex w-full items-center gap-3.5 py-3.5 text-left";
const rows = "divide-y divide-line";
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
  admin,
  next,
  openRegister,
  wallet,
  walletTx,
  membership,
  profile,
  support,
  clubs,
}: {
  slug: string;
  clubName: string;
  user: { name: string } | null;
  admin: boolean;
  /** Safe local path to return to after login/signup, e.g. the Abo page. */
  next?: string;
  openRegister?: boolean;
  wallet: number;
  walletTx: { id: string; amount: number; description: string; date: string }[];
  membership: { name: string; price: number; pending: boolean; validity: string } | null;
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

  const authError = authState && "error" in authState ? authState.error : undefined;
  const chev = <Chevron />;
  const topupBtn = "btn h-11 flex-1 justify-center shadow-none";

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4 px-5 pb-8 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2 @min-[1024px]:max-w-none">
      <div className="flex items-center gap-3.5">
        <Avatar ini={me.ini} className="h-14 w-14 text-[18px]" />
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-.03em]">{me.name}</h1>
          <div className="text-[14px] text-ink-2">{me.sub}</div>
        </div>
      </div>

      {!user && (
        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
          <form action={authAction} className="card flex flex-col gap-3.5 p-5">
            <h2 className="text-[22px] font-bold tracking-[-.02em]">{register ? (next?.includes("/abos") ? "Konto erstellen, dann Abo zahlen" : "Konto erstellen") : "Anmelden"}</h2>
            <input type="hidden" name="callbackUrl" value={next ?? (register ? `/c/${slug}/abos` : `/c/${slug}`)} />
            <input type="hidden" name="tenantSlug" value={slug} />
            {authError && (
              <div role="alert" className="rounded-[14px] bg-bad-bg px-4 py-3 text-[14px] font-semibold text-bad">
                {authError}
              </div>
            )}
            {register && (
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
                Vor- und Nachname
                <input name="name" required defaultValue={authState?.name} autoComplete="name" className={fld} />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
              E-Mail
              <input name="email" type="email" required defaultValue={authState?.email} autoComplete="email" className={`${fld} ${authError && !register ? "shadow-[inset_0_0_0_2px_var(--bad)]" : ""}`} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
              Passwort
              <input name="password" type="password" required autoComplete={register ? "new-password" : "current-password"} className={`${fld} ${authError && !register ? "shadow-[inset_0_0_0_2px_var(--bad)]" : ""}`} />
            </label>
            <button type="submit" disabled={authPending} className="btn btn-pri h-[54px] w-full text-[16px]">
              {authPending && <Spinner />}
              {register ? (next?.includes("/abos") ? "Konto erstellen und bezahlen" : "Konto erstellen") : "Anmelden"}
            </button>
            {!register && !forgot && (
              <button type="button" onClick={() => setForgot(true)} className="text-center text-[14px] font-semibold text-ink-2">
                Konto aktivieren / Passwort vergessen?
              </button>
            )}
          </form>
          {!register && forgot && (
            <form action={linkAction} className="card flex flex-col gap-3 p-5">
              <div className={label}>Passwort vergessen</div>
              {linkState?.ok ? (
                <div role="status" className="text-[15px] leading-[1.45] text-ink-2">
                  Falls ein Konto existiert, haben wir dir einen Link geschickt.
                </div>
              ) : (
                <>
                  <input type="hidden" name="tenantSlug" value={slug} />
                  <input name="email" type="email" required autoComplete="email" aria-label="E-Mail" placeholder="E-Mail" className={fld} />
                  {linkState?.error && <div role="alert" className="text-[14px] font-semibold text-bad">{linkState.error}</div>}
                  <button type="submit" disabled={linkPending} className="btn h-12 w-full">
                    Link senden
                  </button>
                </>
              )}
            </form>
          )}
          <div className="text-center text-[14px] text-ink-2">
            {register ? "Schon ein Konto? " : "Noch kein Konto? "}
            <button type="button" onClick={() => setRegister(!register)} className="font-semibold text-brand-deep">
              {register ? "Anmelden" : "Registrieren"}
            </button>
          </div>
          <div className="text-center text-[14px] text-ink-2">Als Gast zahlst du pro Platz online. Mit einem Abo ist Spielen inklusive.</div>
        </div>
      )}

      {user && (
        <div className="grid items-start gap-4 @min-[640px]:grid-cols-2">
          <div className="flex flex-col gap-4">
            {member && (
              <>
                <div className="flex flex-col gap-3.5 rounded-[24px] bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_60%,#0b433a)] p-5 text-white shadow-[var(--sh-lg)]">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-[17px] font-bold">Guthaben</h2>
                    <span className="text-[13px] opacity-80">für Buchungen und Gäste</span>
                  </div>
                  <div className="text-[48px] font-bold leading-none tracking-[-.04em]">
                    <small className="mr-1.5 text-[18px] font-medium opacity-80">CHF</small>
                    {fmt(wallet)}
                  </div>
                  <div className="flex gap-2">
                    {[20, 50, 100].map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-label={`CHF ${v} aufladen`}
                        onClick={() => topUp(v)}
                        disabled={topping !== null}
                        className={`${topupBtn} ${v === 100 ? "text-brand-dark" : "bg-white/15 text-white"}`}
                      >
                        {topping === v && <Spinner />}+ {v}
                      </button>
                    ))}
                  </div>
                </div>

                {walletTx.length > 0 && (
                  <div className="card p-5">
                    <h2 className="text-[17px] font-bold">Guthaben-Bewegungen</h2>
                    <ul className="mt-2 divide-y divide-border">
                      {walletTx.map((t) => (
                        <li key={t.id} className="flex items-baseline justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-semibold">{t.description}</div>
                            <small className="text-[13px] text-ink-2">{t.date}</small>
                          </div>
                          <b className={`shrink-0 text-[15px] ${t.amount > 0 ? "text-ok" : ""}`}>
                            {t.amount > 0 ? "+" : "−"} {fmt(Math.abs(t.amount))}
                          </b>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[17px] font-bold">Mein Abo</h2>
                    {membership && !membership.pending && <span className="pill bg-ok-bg text-ok">aktiv</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <b className="block text-[16px]">{membership?.name ?? "Kein Abo"}</b>
                      {membership && (
                        <small className="text-[13.5px] text-ink-2">
                          {membership.validity}, CHF {fmt(membership.price)}
                        </small>
                      )}
                    </div>
                    <Link href={`/c/${slug}/abos`} className="btn h-9 text-[13.5px]">
                      {membership ? "Ändern" : "Abo wählen"}
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card p-5">
            <div className={rows}>
              {profile &&
                (editing ? (
                  <form action={profileAction} className="flex flex-col gap-2.5 pb-4">
                    <div className={label}>Meine Daten</div>
                    <div className="flex gap-2.5">
                      <input name="firstName" required defaultValue={profile.firstName} aria-label="Vorname" placeholder="Vorname" autoComplete="given-name" className={fld} />
                      <input name="lastName" required defaultValue={profile.lastName} aria-label="Nachname" placeholder="Nachname" autoComplete="family-name" className={fld} />
                    </div>
                    <input name="phone" type="tel" defaultValue={profile.phone} aria-label="Telefon" placeholder="Telefon" autoComplete="tel" className={fld} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost h-11 flex-1">
                        Abbrechen
                      </button>
                      <button type="submit" disabled={profilePending} className="btn btn-pri h-11 flex-1">
                        {profilePending && <Spinner />}Speichern
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" onClick={() => setEditing(true)} className={row}>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[16px] font-semibold">Meine Daten</b>
                      <small className="block truncate text-[13.5px] text-ink-2">
                        {`${profile.firstName} ${profile.lastName}`.trim()}
                        {profile.phone ? `, ${profile.phone}` : ""}
                      </small>
                    </span>
                    <span className="text-[14px] font-semibold text-brand-deep">Bearbeiten</span>
                  </button>
                ))}
              {clubs.length > 1 && (
                <div className="py-3.5">
                  <div className={label}>Club wechseln</div>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {clubs.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        aria-current={c.slug === slug}
                        onClick={() => router.push(`/c/${c.slug}`)}
                        className={`flex h-12 items-center justify-between rounded-[14px] px-4 text-[15px] font-semibold ${c.slug === slug ? "bg-brand-deep text-white" : "bg-bg"}`}
                      >
                        {c.name}
                        {c.slug === slug && <span className="text-[13px] font-bold">Aktiv</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(support.email || support.phone) && (
                <div className="py-3.5">
                  <b className="block text-[16px] font-semibold">Hilfe und Kontakt</b>
                  <small className="block text-[13.5px] text-ink-2">Fragen zu Buchungen oder deinem Abo? Der Club hilft dir weiter.</small>
                  <div className="mt-3 flex gap-2">
                    {support.email && (
                      <a href={`mailto:${support.email}`} className="btn btn-ghost h-11 flex-1">
                        E-Mail
                      </a>
                    )}
                    {support.phone && (
                      <a href={`tel:${support.phone.replace(/\s+/g, "")}`} className="btn btn-ghost h-11 flex-1">
                        Anrufen
                      </a>
                    )}
                  </div>
                </div>
              )}
              <button type="button" aria-pressed={dark} onClick={toggleDark} className={row}>
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px] font-semibold">Dunkles Design</b>
                  <small className="block text-[13.5px] text-ink-2">{dark ? "Nocturne, dunkel" : "Tag, hell"}</small>
                </span>
                <SwitchKnob on={dark} />
              </button>
              <form action={logoutAction}>
                <button type="submit" className={row}>
                  <b className="flex-1 text-[16px] font-semibold text-bad">Abmelden</b>
                  {chev}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
