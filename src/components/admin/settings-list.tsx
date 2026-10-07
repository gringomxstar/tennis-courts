"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SettingsGroups } from "@/app/c/[clubSlug]/admin/settings/overview";

/** Settings topics with their current state; the open topic is highlighted (desktop left column). */
export function SettingsList({ base, missing, groups }: { base: string; missing: string[]; groups: SettingsGroups }) {
  const path = usePathname();
  return (
    <div className="flex flex-col gap-2">
      {missing.length > 0 && (
        <Link href={`${base}/zahlungen#rechnungsdaten`} className="mb-2 flex items-center gap-3 rounded-[18px] bg-warn-bg px-4 py-3 text-[14px] text-warn">
          <span className="flex-1">{missing.join(" und ")} {missing.length > 1 ? "fehlen" : "fehlt"}. Rechnungen werden erst danach verschickt.</span>
          <b className="shrink-0">Ergänzen ›</b>
        </Link>
      )}
      {groups.map(([title, rows]) => (
        <section key={title} className="flex flex-col gap-2">
          <h2 className="mt-2 px-1 text-[12px] font-bold uppercase tracking-[.06em] text-ink-3">{title}</h2>
          <div className="card overflow-hidden">
            {rows.map(([id, name, sub, warn]) => {
              const on = path === `${base}/${id}`;
              return (
                <Link key={id} href={`${base}/${id}`} aria-current={on ? "page" : undefined} className={cn("flex min-h-[64px] items-center gap-3 border-t border-line px-4 py-3 first:border-t-0", on && "bg-brand-tint")}>
                  <span className="min-w-0 flex-1">
                    <b className={cn("block text-[16px]", on && "text-brand-deep")}>{name}</b>
                    <small className="block truncate text-[13px] text-ink-3">{sub}</small>
                  </span>
                  {warn && <span className="pill shrink-0 bg-warn-bg text-warn">{warn}</span>}
                  <span aria-hidden className="text-[20px] text-ink-3">›</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
