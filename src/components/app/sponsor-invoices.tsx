"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { chf } from "@/lib/sponsoring";
import { pill } from "@/components/app/admin-sponsoring";
import { markInvoicePaidAction } from "@/app/actions/sponsoring";

type Inv = { id: string; number: number; sponsorId: string; sponsor: string; token: string; amount: number; issuedAt: string; dueAt: string; paidAt: string; dunningLevel: number; overdue: boolean };
const de = (iso: string) => new Date(iso).toLocaleDateString("de-CH");

export function SponsorInvoices({ slug, year, invoices }: { slug: string; year: number; invoices: Inv[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<"all" | "open" | "overdue" | "paid">("all");
  const state = (i: Inv) => (i.paidAt ? "paid" : i.overdue ? "overdue" : "open");
  const list = invoices.filter((i) => filter === "all" || state(i) === filter || (filter === "open" && state(i) === "overdue"));
  const sum = (f: (i: Inv) => boolean) => invoices.filter(f).reduce((a, i) => a + i.amount, 0);
  return (
    <section className="px-5 pb-10 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {([["all", "Alle", sum(() => true)], ["open", "Offen", sum((i) => !i.paidAt)], ["overdue", "Überfällig", sum((i) => state(i) === "overdue")], ["paid", "Bezahlt", sum((i) => Boolean(i.paidAt))]] as const).map(([k, l, v]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className="chip">{l} <span className="tabular-nums opacity-70">{chf(v)}</span></button>
        ))}
        <a href={`/c/${slug}/admin/sponsoring/rechnungen/export?jahr=${year}`} className={cn(pill, "ml-auto bg-card text-ink shadow-card")}>Export Buchhaltung (CSV)</a>
      </div>
      <p className="mt-2 text-[13px] text-ink-3">Zahlbar in 30 Tagen. Automatische Zahlungserinnerung 10 Tage nach Fälligkeit, 2. Mahnung 14 Tage später, danach eine Aufgabe für die zuständige Person.</p>
      <ul className="card mt-3 divide-y divide-line">
        {list.map((i) => {
          const st = state(i);
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[14.5px]">
              <a href={`/sponsor/${i.token}/rechnung/${i.id}`} target="_blank" rel="noreferrer" className="w-16 font-semibold tabular-nums text-brand-deep">{i.number}</a>
              <Link href={`/c/${slug}/admin/sponsoring/${i.sponsorId}`} className="min-w-0 flex-1 truncate font-semibold">{i.sponsor}</Link>
              <span className="tabular-nums">{chf(i.amount)}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", st === "paid" ? "bg-ok-bg text-ok" : st === "overdue" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn")}>
                {st === "paid" ? `bezahlt ${de(i.paidAt)}` : st === "overdue" ? `überfällig${i.dunningLevel ? ` · ${Math.min(i.dunningLevel, 2)}. Mahnung` : ""}` : `fällig ${de(i.dueAt)}`}
              </span>
              <button type="button" disabled={pending} onClick={() => start(async () => {
                const r = await markInvoicePaidAction(slug, i.id, !i.paidAt);
                if (!r.success) return void toast.error(r.error);
                router.refresh();
              })} className={cn(pill, i.paidAt ? "bg-bg text-ink" : "bg-brand-deep text-white")}>{i.paidAt ? "Doch offen" : "Bezahlt"}</button>
            </li>
          );
        })}
        {!list.length && <li className="px-4 py-6 text-center text-[14px] text-ink-3">Keine Rechnungen {year}.</li>}
      </ul>
    </section>
  );
}
