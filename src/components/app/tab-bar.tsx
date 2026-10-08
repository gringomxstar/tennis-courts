"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/app/avatar";
import { cn } from "@/lib/utils";

const P = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  book: "M4 6h16M4 12h16M4 18h10",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  shield: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  ticket: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zM13 5v2M13 17v2M13 11v2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
};

const onFold = (cb: () => void) => {
  window.addEventListener("nav-mini", cb);
  return () => window.removeEventListener("nav-mini", cb);
};
const readMini = () => {
  try {
    return localStorage.getItem("nav-mini") === "1";
  } catch {
    return false;
  }
};

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/**
 * App shell from design v3, one markup for all widths (container queries on the club layout):
 * phone = dark floating pill at the bottom; from 640 = icon rail left + topbar with pill nav, search, avatar.
 */
export function TabBar({
  slug,
  clubName,
  logoUrl,
  anon = false,
  canAdmin = false,
  ini,
  children,
}: {
  slug: string;
  clubName: string;
  logoUrl?: string | null;
  anon?: boolean;
  canAdmin?: boolean;
  /** initials of the signed-in user, for the avatar */
  ini?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const base = `/c/${slug}`;
  const tabs: [string, string, string][] = anon
    ? [
        [base, "Start", P.home],
        [`${base}/calendar`, "Kalender", P.cal],
        [`${base}/abos`, "Abos", P.ticket],
        [`${base}/profile`, "Anmelden", P.user],
      ]
    : [
        [base, "Start", P.home],
        [`${base}/calendar`, "Kalender", P.cal],
        [`${base}/bookings`, "Buchungen", P.book],
        [`${base}/profile`, "Profil", P.user],
        ...(canAdmin ? [[`${base}/admin`, "Verwaltung", P.gear] as [string, string, string]] : []),
      ];
  const inAdmin = canAdmin && !anon && (path === `${base}/admin` || path.startsWith(`${base}/admin/`));
  const pills: [string, string][] = inAdmin
    ? [["", "Übersicht"], ["/today", "Heute"], ["/members", "Mitglieder"], ["/blocks", "Sperren"], ["/sponsoring", "Sponsoring"], ["/events", "Anlässe"], ["/stats", "Statistik"], ["/settings", "Einstellungen"]].map(([k, l]) => [`${base}/admin${k}`, l])
    : tabs.filter(([href]) => href !== `${base}/admin`).map(([href, l]) => [href, l]);
  // prefix match: /admin/* lights Verwaltung
  const activeOf = (hrefs: string[]) =>
    hrefs.filter((href) => path === href || (href !== base && href !== `${base}/admin` && path.startsWith(href + "/"))).sort((a, b) => b.length - a.length)[0];
  const active = activeOf(tabs.map(([h]) => h));
  const activePill = activeOf(pills.map(([h]) => h));
  const main = tabs.filter(([href]) => href !== `${base}/admin`);
  const admin = tabs.find(([href]) => href === `${base}/admin`);
  // from 1100 the rail shows text (and the admin sections); the user can fold it back to icons, remembered per browser
  const mini = useSyncExternalStore(onFold, readMini, () => false);
  const fold = () => {
    try {
      localStorage.setItem("nav-mini", mini ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event("nav-mini"));
  };
  const wide = mini ? "hidden" : "hidden @min-[1100px]:inline";
  const railLink = ([href, label, d]: [string, string, string]) => (
    <Link
      key={href}
      href={href}
      title={label}
      aria-label={label}
      aria-current={href === active ? "page" : undefined}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center gap-3 rounded-full text-ink-2",
        !mini && "@min-[1100px]:w-full @min-[1100px]:justify-start @min-[1100px]:rounded-[14px] @min-[1100px]:px-3.5 @min-[1100px]:font-semibold",
        href === active && "bg-brand-deep text-white shadow-[0_8px_18px_-8px_rgba(15,92,79,.6)]"
      )}
    >
      <Icon d={d} />
      <span className={wide}>{label}</span>
    </Link>
  );

  return (
    <div className={cn("@min-[640px]:grid @min-[640px]:grid-cols-[72px_minmax(0,1fr)] @min-[640px]:gap-4 @min-[640px]:p-4", !mini && "@min-[1100px]:grid-cols-[232px_minmax(0,1fr)]")}>
      <nav aria-label="Navigation" className={cn("card sticky top-4 hidden h-[calc(100dvh-32px)] flex-col items-center gap-1.5 self-start overflow-y-auto py-3.5 @min-[640px]:flex", !mini && "@min-[1100px]:items-stretch @min-[1100px]:px-3")}>
        <Link href={base} aria-label={clubName} className="mb-3.5 flex shrink-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-brand-deep text-[13px] font-extrabold tracking-[-.04em] text-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
            {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full bg-white object-contain" /> : clubName.replace(/[^A-Z]/g, "").slice(0, 2) || "TC"}
          </span>
          <b className={cn(wide, "truncate text-[15px]")}>{clubName}</b>
        </Link>
        {main.map(railLink)}
        {admin && (
          <>
            <div className="my-1.5 h-px w-7 shrink-0 self-center bg-line" />
            {railLink(admin)}
            {inAdmin &&
              pills.slice(1).map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={href === activePill ? "page" : undefined}
                  className={cn(wide, "shrink-0 rounded-[12px] py-2 pl-12 pr-3 text-[14px] font-medium text-ink-2 hover:bg-inset", href === activePill && "bg-brand-tint font-bold text-brand-deep")}
                >
                  {label}
                </Link>
              ))}
          </>
        )}
        <div className={cn("mt-auto flex flex-col items-center gap-2.5 pt-2", !mini && "@min-[1100px]:items-stretch")}>
          <button type="button" onClick={fold} title={mini ? "Menü aufklappen" : "Menü einklappen"} className="hidden h-10 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-inset px-3 text-[14px] font-semibold text-ink-2 @min-[1100px]:flex">
            {mini ? "»" : "« Einklappen"}
          </button>
          {ini && (
            <Link href={`${base}/profile`} aria-label="Profil">
              <Avatar ini={ini} className="h-9 w-9 text-[12px]" />
            </Link>
          )}
        </div>
      </nav>

      <div className="min-w-0">
        <header className="hidden items-center gap-2.5 pb-4 @min-[640px]:flex">
          <nav aria-label={inAdmin ? "Verwaltung" : "Bereiche"} className={cn("no-scrollbar inline-flex min-w-0 gap-1 overflow-x-auto rounded-full bg-card p-1 shadow-card", !mini && "@min-[1100px]:hidden")}>
            {pills.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={href === activePill ? "page" : undefined}
                className={cn(
                  "flex-none rounded-full px-3 py-2 text-[14px] font-semibold text-ink-2 @min-[1100px]:px-4",
                  href === activePill && "bg-brand-deep text-white"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          {canAdmin && !anon && (
            <form action={`${base}/admin/members`} className="hidden h-[42px] w-full max-w-[300px] items-center gap-2 rounded-full bg-card px-4 text-ink-3 shadow-card @min-[1100px]:flex">
              <Icon d={P.search} size={16} />
              <input name="q" type="search" aria-label="Mitglied suchen" placeholder="Mitglied suchen" className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3" />
            </form>
          )}
          {ini ? (
            <Link href={`${base}/profile`} aria-label="Profil">
              <Avatar ini={ini} />
            </Link>
          ) : (
            <Link href={`${base}/profile`} className="btn btn-pri">Anmelden</Link>
          )}
        </header>
        {inAdmin && (
          // phone: admin sections one tap apart (the header pills above are desktop only)
          <nav aria-label="Verwaltung" className="no-scrollbar sticky top-0 z-30 flex gap-2 overflow-x-auto bg-bg px-5 pb-2 pt-[max(12px,env(safe-area-inset-top))] @min-[640px]:hidden">
            {pills.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={href === activePill ? "page" : undefined}
                ref={href === activePill ? (el) => el?.scrollIntoView({ inline: "center", block: "nearest" }) : undefined}
                className={cn("chip", href === activePill && "!bg-ink !text-card")}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        <main className="pb-[calc(max(10px,env(safe-area-inset-bottom))+88px)] @min-[640px]:pb-0">{children}</main>
      </div>

      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-20 h-[60px] @min-[640px]:hidden" style={{ background: "var(--top-mask)" }} />
      <nav
        aria-label="Hauptnavigation"
        className="pointer-events-none fixed inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-30 flex justify-center @min-[640px]:hidden"
      >
        <div className="pointer-events-auto flex gap-0.5 rounded-full bg-[rgba(22,32,29,.94)] p-1.5 shadow-[0_16px_40px_-14px_rgba(22,32,29,.6)] backdrop-blur-[20px]">
          {tabs.map(([href, label, d]) => {
            const on = href === active;
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex h-[46px] items-center justify-center rounded-full px-[13px] text-[14px] font-semibold transition-all duration-[450ms] ease-spring",
                  on ? "bg-go text-white" : "text-white/60"
                )}
              >
                <Icon d={d} />
                <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-[450ms] ease-spring", on ? "ml-[7px] max-w-[90px] opacity-100" : "ml-0 max-w-0 opacity-0")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
