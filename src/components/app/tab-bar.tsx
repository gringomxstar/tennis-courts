"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const P = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  book: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-1.97 1.47C7.85 18.9 7 20.24 7 22M14 14.66V17c0 .55.47.98 1.97 1.47 1.18.43 2.03 1.77 2.03 3.53M18 2H6v7a6 6 0 0 0 12 0V2z",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  shield: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  ban: "M4.9 4.9l14.2 14.2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  ticket: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zM13 5v2M13 17v2M13 11v2",
  more: "M4 6h16M4 12h16M4 18h16",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
};

export function TabBar({ slug, clubName, logoUrl, anon = false, canAdmin = false }: { slug: string; clubName: string; logoUrl?: string | null; anon?: boolean; canAdmin?: boolean }) {
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
        ...(canAdmin ? [[`${base}/admin`, "Verwaltung", P.shield] as [string, string, string]] : []),
      ];
  const subs = canAdmin && !anon
    ? [["today", "Heute"], ["members", "Mitglieder"], ["blocks", "Sperren"], ["stats", "Statistik"], ["settings", "Einstellungen"]]
    : [];
  // prefix match: /admin/* lights Verwaltung
  const active = tabs
    .map(([href]) => href)
    .filter((href) => path === href || path.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-20 h-[60px] lg:hidden" style={{ background: "var(--top-mask)" }} />
      <nav
        aria-label="Hauptnavigation"
        className="pointer-events-none fixed inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-30 flex justify-center lg:inset-y-0 lg:left-0 lg:right-auto lg:w-64 lg:items-stretch lg:justify-start"
      >
        <div className="pointer-events-auto flex gap-1 rounded-full border border-border bg-glass p-1.5 shadow-elevation backdrop-blur-[24px] backdrop-saturate-[1.6] lg:h-full lg:w-full lg:flex-col lg:gap-1 lg:rounded-none lg:border-y-0 lg:border-l-0 lg:px-4 lg:pb-6 lg:pt-10 lg:shadow-none">
          <div className="hidden items-center gap-3 px-3 pb-6 text-[22px] font-bold tracking-[-.02em] lg:flex">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
            {logoUrl && <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />}
            {clubName}
          </div>
          {tabs.map(([href, label, d]) => {
            const on = href === active;
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex h-[52px] items-center justify-center rounded-full transition-all duration-[450ms] ease-spring lg:justify-start lg:px-4",
                  on ? "bg-clay px-[18px] text-white" : "px-[15px] text-muted-foreground"
                )}
              >
                <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d={d} />
                </svg>
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-[15px] font-bold transition-all duration-[450ms] ease-spring lg:ml-3 lg:max-w-none lg:opacity-100",
                    on ? "ml-2 max-w-[90px] opacity-100" : "ml-0 max-w-0 opacity-0"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
          {subs.length > 0 && (
            <>
              <div className="mb-1 mt-6 hidden px-4 text-[12px] font-bold uppercase tracking-[.08em] text-muted-foreground lg:block">Verwaltung</div>
              {subs.map(([k, label]) => {
                const href = `${base}/admin/${k}`;
                const on = path === href || path.startsWith(href + "/");
                return (
                  <Link
                    key={k}
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={cn("hidden h-[44px] items-center rounded-full px-4 text-[14px] font-bold lg:flex", on ? "bg-clay text-white" : "text-muted-foreground")}
                  >
                    {label}
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </nav>
    </>
  );
}
