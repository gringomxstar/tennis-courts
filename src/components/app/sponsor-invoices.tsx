"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { chf } from "@/lib/sponsoring";
import { pill } from "@/components/app/admin-sponsoring";
import { markInvoicePaidAction } from "@/app/actions/sponsoring";

type Inv = { id: string; number: number; sponsorId: string; sponsor: string; token: string; amount: number; issuedAt: string; dueAt: string; paidAt: string; dunningLevel: number; overdue: boolean; sentAt: string };
const de = (iso: string) => new Date(iso).toLocaleDateString("de-CH");

type SortKey = "number" | "sponsor" | "amount" | "issuedAt" | "dueAt" | "state";
const SORTS: [SortKey, string][] = [["number", "Nummer"], ["sponsor", "Firma"], ["amount", "Betrag"], ["issuedAt", "Datum"], ["dueAt", "Fällig"], ["state", "Status"]];
const SORT_KEY = "sponsoring-invoices-sort";
const subSort = (cb: () => void) => { window.addEventListener("sponsoring-invoices-sort", cb); return () => window.removeEventListener("sponsoring-invoices-sort", cb); };
const readSort = () => { try { return localStorage.getItem(SORT_KEY); } catch { return null; } };
const saveSort = (k: SortKey, d: 1 | -1) => { try { localStorage.setItem(SORT_KEY, `${k}:${d}`); } catch {} window.dispatchEvent(new Event("sponsoring-invoices-sort")); };
const ROW_GRID = "@min-[1024px]:grid @min-[1024px]:grid-cols-[64px_minmax(0,1.6fr)_100px_90px_90px_minmax(0,1.4fr)_110px] @min-[1024px]:gap-4";
type Filter = "ALL" | "open" | "overdue" | "dunned" | "paid" | "unsent";
const FILTERS: [Filter, string, (i: Inv) => boolean][] = [
  ["ALL", "Alle", () => true],
  ["open", "Offen", (i) => !i.paidAt],
  ["overdue", "Überfällig", (i) => !i.paidAt && i.overdue],
  ["dunned", "Gemahnt", (i) => i.dunningLevel > 0],
  ["paid", "Bezahlt", (i) => Boolean(i.paidAt)],
  ["unsent", "Nicht versendet", (i) => !i.sentAt],
];

export function SponsorInvoices({ slug, year, invoices, sample }: { slug: string; year: number; invoices: Inv[]; sample: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sk, sd] = (useSyncExternalStore(subSort, readSort, () => null) ?? "number:-1").split(":");
  const sortKey: SortKey = SORTS.some(([k]) => k === sk) ? (sk as SortKey) : "number";
  const dir: 1 | -1 = sd === "1" ? 1 : -1;
  const clickSort = (k: SortKey) => saveSort(k, k === sortKey ? (dir === 1 ? -1 : 1) : 1);
  const state = (i: Inv) => (i.paidAt ? "paid" : i.overdue ? "overdue" : "open");
  const pred = FILTERS.find(([k]) => k === filter)![2];
  const ql = q.trim().toLowerCase();
  const list = invoices.filter((i) => pred(i) && (!ql || `${i.sponsor} ${i.number}`.toLowerCase().includes(ql)))
    .sort((a, b) => {
      const v = (i: Inv): string | number => {
        switch (sortKey) {
          case "number": return i.number;
          case "sponsor": return i.sponsor.toLowerCase();
          case "amount": return i.amount;
          case "issuedAt": return i.issuedAt;
          case "dueAt": return i.dueAt;
          case "state": return ["overdue", "open", "paid"].indexOf(state(i));
        }
      };
      const x = v(a), y = v(b);
      return (typeof x === "string" ? x.localeCompare(y as string, "de") : x - (y as number)) * dir;
    });
  const total = list.reduce((a, i) => a + i.amount, 0);
  const openSum = list.filter((i) => !i.paidAt).reduce((a, i) => a + i.amount, 0);
  return (
    <section className="px-5 pb-10 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma, Rechnungsnummer" aria-label="Suchen"
          className="h-[42px] min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-[15px] outline-none focus-visible:border-clay" />
        <span className="flex gap-2 @min-[1024px]:hidden">
          <select value={sortKey} onChange={(e) => saveSort(e.target.value as SortKey, dir)} aria-label="Sortieren" className="h-[42px] rounded-full border border-border bg-card px-3 text-[14px]">
            {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button type="button" onClick={() => saveSort(sortKey, dir === 1 ? -1 : 1)} aria-label={dir === 1 ? "Aufsteigend, umkehren" : "Absteigend, umkehren"} className="h-[42px] rounded-full border border-border bg-card px-3 text-[14px]">{dir === 1 ? "▲" : "▼"}</button>
        </span>
        <a href={`/c/${slug}/admin/sponsoring/rechnungen/export?jahr=${year}`} className={cn(pill, "bg-card text-ink shadow-card")}>Export Buchhaltung (CSV)</a>
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([k, l, f]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className="chip shrink-0">{l} <span className="tabular-nums opacity-70">{invoices.filter(f).length}</span></button>
        ))}
      </div>
      {sample && (
        <p role="note" className="mt-3 rounded-[14px] bg-bad-bg p-3 text-[14px] text-bad">
          <b>Muster-QR:</b> IBAN oder Clubadresse fehlen in den Einstellungen. Die Rechnungen zeigen darum einen fiktiven, als MUSTER markierten QR-Zahlteil. Vor dem ersten echten Versand IBAN und Adresse (Strasse Nr, PLZ Ort) erfassen: <Link href={`/c/${slug}/admin/settings/zahlungen#rechnungsdaten`} className="font-bold underline">Jetzt ergänzen ›</Link>
        </p>
      )}
      <p className="mt-2 text-[13px] text-ink-3">Zahlbar in 30 Tagen. Automatische Zahlungserinnerung 10 Tage nach Fälligkeit, 2. Mahnung 14 Tage später, danach eine Aufgabe für die zuständige Person.</p>
      <p className="mt-3 text-[14px] tabular-nums">{list.length} Rechnungen · <b>{chf(total)}</b>, davon offen <b>{chf(openSum)}</b></p>
      <div className="card mt-2 p-1">
        <div className={cn("hidden px-3 py-3 text-[12.5px] font-semibold text-ink-3 @min-[1024px]:grid", ROW_GRID)}>
          {SORTS.map(([k, l]) => (
            <span key={k} role="columnheader" aria-sort={sortKey === k ? (dir === 1 ? "ascending" : "descending") : "none"}>
              <button type="button" onClick={() => clickSort(k)} className="inline-flex items-center gap-1 text-left font-semibold hover:text-ink">{l}{sortKey === k && <span aria-hidden>{dir === 1 ? "▲" : "▼"}</span>}</button>
            </span>
          ))}
        </div>
        <ul className="divide-y divide-line">
          {list.map((i) => {
            const st = state(i);
            return (
              <li key={i.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 text-[14.5px]", ROW_GRID)}>
                <a href={`/sponsor/${i.token}/rechnung/${i.id}`} target="_blank" rel="noreferrer" className="w-16 font-semibold tabular-nums text-brand-deep">{i.number}</a>
                <Link href={`/c/${slug}/admin/sponsoring/${i.sponsorId}`} className="min-w-0 flex-1 truncate font-semibold @min-[1024px]:flex-none">{i.sponsor}</Link>
                <span className="tabular-nums">{chf(i.amount)}</span>
                <span className="hidden tabular-nums @min-[1024px]:block">{de(i.issuedAt)}</span>
                <span className="hidden tabular-nums @min-[1024px]:block">{de(i.dueAt)}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", st === "paid" ? "bg-ok-bg text-ok" : st === "overdue" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn")}>
                    {st === "paid" ? `bezahlt ${de(i.paidAt)}` : st === "overdue" ? `überfällig${i.dunningLevel ? ` · ${Math.min(i.dunningLevel, 2)}. Mahnung` : ""}` : `fällig ${de(i.dueAt)}`}
                  </span>
                  {!i.sentAt && <span className="rounded-full bg-bg px-2 py-0.5 text-[12px] font-bold text-ink-2">nicht versendet</span>}
                </span>
                <button type="button" disabled={pending} onClick={() => start(async () => {
                  const r = await markInvoicePaidAction(slug, i.id, !i.paidAt);
                  if (!r.success) return void toast.error(r.error);
                  router.refresh();
                })} className={cn(pill, i.paidAt ? "bg-bg text-ink" : "bg-brand-deep text-white")}>{i.paidAt ? "Doch offen" : "Bezahlt"}</button>
              </li>
            );
          })}
          {!list.length && <li className="px-4 py-6 text-center text-[14px] text-ink-3">{invoices.length ? "Keine Treffer." : `Keine Rechnungen ${year}.`}</li>}
        </ul>
      </div>
    </section>
  );
}
