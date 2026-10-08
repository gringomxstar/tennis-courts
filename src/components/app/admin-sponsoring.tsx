"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STAGES, chf, type Stage } from "@/lib/sponsoring";
import { parseSponsors } from "@/lib/sponsor-import";
import { xlsxToText } from "@/lib/xlsx";
import { Sheet } from "@/components/app/sheet";
import { SponsorMailSheet } from "@/components/app/sponsor-mail";
import { SponsorBoard } from "@/components/app/sponsor-board";
import { completeTaskAction, importSponsorsAction, saveSponsorAction, startCampaignAction } from "@/app/actions/sponsoring";

export type SponsorStatus = "NONE" | "REQUESTED" | "REMINDED" | "CONFIRMED" | "DECLINED";
export type SponsorRow = {
  id: string; name: string; contact: string; hasEmail: boolean; ownerId: string; owner: string;
  status: SponsorStatus; queued: boolean; amount: number; runningUntil: number | null; billed: number; paid: number;
  email: string; firstName: string; city: string; stage: Stage; followUp: string | null; due: boolean;
  endsInDays: number | null; endYear: number | null; dunning: number; itemIds: string[];
  phone: string; updatedAt: string; lastNote: { text: string; at: string } | null;
};
type Task = { id: string; title: string; sponsorId: string; sponsor: string; assigneeId: string; assignee: string; createdAt: string };

export const STATUS: Record<SponsorStatus, [string, string]> = {
  NONE: ["nicht angefragt", "bg-bg text-ink-2"],
  REQUESTED: ["angefragt", "bg-brand-tint text-brand-deep"],
  REMINDED: ["erinnert", "bg-warn-bg text-warn"],
  CONFIRMED: ["zugesagt", "bg-ok-bg text-ok"],
  DECLINED: ["abgesagt", "bg-bad-bg text-bad"],
};
export const STAGE_CLASS: Record<Stage, string> = { INTERESTED: "bg-bg text-ink-2", OFFER: "bg-brand-tint text-brand-deep", NEGOTIATION: "bg-warn-bg text-warn", WON: "bg-ok-bg text-ok", LOST: "bg-bad-bg text-bad" };
export const pill = "inline-flex min-h-10 items-center justify-center rounded-full px-3.5 py-2 text-[13px] font-bold";
export const field = "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";
export const fieldLabel = "block text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";

const VIEW_KEY = "sponsoring-view";
const subView = (cb: () => void) => { window.addEventListener("sponsoring-view", cb); return () => window.removeEventListener("sponsoring-view", cb); };
const readView = () => { try { return localStorage.getItem(VIEW_KEY); } catch { return null; } };
type SortKey = "name" | "stage" | "amount" | "owner" | "followUp" | "end";
const SORTS: [SortKey, string][] = [["name", "Firma"], ["stage", "Stufe"], ["amount", "Betrag"], ["owner", "Verantwortlicher"], ["followUp", "Wiedervorlage"], ["end", "Vertragsende"]];
const SORT_KEY = "sponsoring-sort";
const subSort = (cb: () => void) => { window.addEventListener("sponsoring-sort", cb); return () => window.removeEventListener("sponsoring-sort", cb); };
const readSort = () => { try { return localStorage.getItem(SORT_KEY); } catch { return null; } };
const saveSort = (k: SortKey, d: 1 | -1) => { try { localStorage.setItem(SORT_KEY, `${k}:${d}`); } catch {} window.dispatchEvent(new Event("sponsoring-sort")); };
const ROW_GRID = "@min-[1024px]:grid @min-[1024px]:grid-cols-[24px_minmax(0,2.2fr)_120px_100px_minmax(0,1.2fr)_110px_120px] @min-[1024px]:gap-4";
const MQ = "(min-width: 1024px)";
const subMq = (cb: () => void) => { const m = window.matchMedia(MQ); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const saveView = (v: "board" | "list") => { try { localStorage.setItem(VIEW_KEY, v); } catch {} window.dispatchEvent(new Event("sponsoring-view")); };

export function SponsorNav({ slug, active, year }: { slug: string; active: "" | "katalog" | "rechnungen"; year: number }) {
  const base = `/c/${slug}/admin/sponsoring`;
  return (
    <nav aria-label="Sponsoring" className="flex flex-wrap items-center gap-2 px-5 pt-4">
      {([["", "Übersicht"], ["katalog", "Katalog"], ["rechnungen", "Rechnungen"]] as const).map(([k, l]) => (
        <Link key={k} href={`${base}${k ? `/${k}` : ""}?jahr=${year}`} aria-current={active === k ? "page" : undefined}
          className={cn(pill, active === k ? "bg-ink text-card" : "bg-card text-ink shadow-card")}>{l}</Link>
      ))}
      <span className="ml-auto flex items-center gap-1">
        <Link href={`${base}${active ? `/${active}` : ""}?jahr=${year - 1}`} aria-label="Vorjahr" className={cn(pill, "bg-card shadow-card")}>‹</Link>
        <b className="px-2 text-[15px] tabular-nums">{year}</b>
        <Link href={`${base}${active ? `/${active}` : ""}?jahr=${year + 1}`} aria-label="Folgejahr" className={cn(pill, "bg-card shadow-card")}>›</Link>
      </span>
    </nav>
  );
}

export function AdminSponsoring(p: {
  slug: string; year: number; meId: string; sample: boolean; rows: SponsorRow[];
  totals: { committed: number; billed: number; paid: number; renewal: number | null; prevCount: number };
  campaign: { startedAt: string; reminderDays: number; taskDays: number } | null;
  board: { id: string; name: string }[]; tasks: Task[]; items: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SponsorStatus | "ALL">("ALL");
  const [owner, setOwner] = useState("");
  const [item, setItem] = useState("");
  const [mine, setMine] = useState(false);
  const [stage, setStage] = useState<Stage | "">("");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mailOpen, setMailOpen] = useState(false);
  const [sheet, setSheet] = useState<"" | "new" | "import" | "campaign">("");
  const [pending, start] = useTransition();
  const stored = useSyncExternalStore(subView, readView, () => null);
  const dev = useSyncExternalStore(subMq, () => (window.matchMedia(MQ).matches ? "d" : "m"), () => "");
  const desktop = dev === "d";
  const [sk, sd] = (useSyncExternalStore(subSort, readSort, () => null) ?? "name:1").split(":");
  const sortKey: SortKey = SORTS.some(([k]) => k === sk) ? (sk as SortKey) : "name";
  const dir: 1 | -1 = sd === "-1" ? -1 : 1;
  const clickSort = (k: SortKey) => saveSort(k, k === sortKey ? (dir === 1 ? -1 : 1) : 1);
  // ponytail: view is null until mounted (no flash of the wrong view); choice persisted in localStorage
  const view = stored === "board" || stored === "list" ? stored : dev === "" ? null : desktop ? "board" : "list";

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: p.rows.length };
    for (const r of p.rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [p.rows]);
  const ql = q.trim().toLowerCase();
  const list = p.rows.filter((r) =>
    (status === "ALL" || r.status === status) && (!owner || r.ownerId === owner) && (!item || r.itemIds.includes(item)) && (!stage || r.stage === stage) &&
    (!flags.due || r.due) && (!flags.end || (r.endsInDays != null && r.endsInDays <= 90)) && (!flags.dun || r.dunning > 0) && (!flags.nomail || !r.hasEmail) &&
    (!ql || `${r.name} ${r.contact} ${r.email} ${r.city}`.toLowerCase().includes(ql)))
    .sort((a, b) => {
      // empty values always last, regardless of direction
      const v = (r: SponsorRow): string | number | null => {
        switch (sortKey) {
          case "name": return r.name.toLowerCase();
          case "stage": return STAGES.findIndex((x) => x.value === r.stage);
          case "amount": return r.amount > 0 ? r.amount : null;
          case "owner": return r.owner ? r.owner.toLowerCase() : null;
          case "followUp": return r.followUp;
          case "end": return r.endsInDays;
        }
      };
      const x = v(a), y = v(b);
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      return (typeof x === "string" ? x.localeCompare(y as string, "de") : x - (y as number)) * dir;
    });
  const dueList = list.filter((r) => r.due);
  const restList = list.filter((r) => !r.due);
  const allPicked = list.length > 0 && list.every((r) => picked.has(r.id));
  const toggleMany = (ids: string[]) => setPicked((s) => { const n = new Set(s); const all = ids.every((i) => n.has(i)); ids.forEach((i) => (all ? n.delete(i) : n.add(i))); return n; });
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopSelect = () => { setSelecting(false); setPicked(new Set()); };
  const endText = (r: SponsorRow) => r.endsInDays == null ? "" : r.endsInDays < 0 ? "abgelaufen" : `in ${r.endsInDays} Tagen`;
  const recipients = p.rows.filter((r) => picked.has(r.id));
  const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", timeZone: "Europe/Zurich" });
  const rowEl = (r: SponsorRow) => {
    const on = picked.has(r.id);
    return (
      <li key={r.id} className={cn("flex items-center gap-3 rounded-[14px] px-3 py-2.5", ROW_GRID, on && "bg-brand-tint")}>
        <input type="checkbox" checked={on} onChange={() => toggle(r.id)} aria-label={`${r.name} auswählen`} className="h-[18px] w-[18px] shrink-0 accent-brand-deep" />
        <Link href={`/c/${p.slug}/admin/sponsoring/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 @min-[1024px]:block">
          <span className="block min-w-0 flex-1">
            <span className="block truncate font-semibold">{r.name}</span>
            <span className="block truncate text-[13px] text-ink-2 @min-[1024px]:text-ink-3">
              <span className="@min-[1024px]:hidden">{[r.followUp && `Wiedervorlage ${fmt(r.followUp)}`, r.endsInDays != null && r.endsInDays <= 90 && `endet in ${Math.max(0, r.endsInDays)} Tagen`, r.dunning > 0 && `${r.dunning}. Mahnung`, !r.hasEmail && "keine E-Mail", r.queued && "Mail in Warteschlange", !r.followUp && r.contact].filter(Boolean).join(" · ")}</span>
              <span className="hidden @min-[1024px]:inline">{[r.contact, r.email, r.dunning > 0 && `${r.dunning}. Mahnung`, !r.hasEmail && "keine E-Mail", r.queued && "Mail in Warteschlange"].filter(Boolean).join(" · ")}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3 @min-[1024px]:hidden">
            {r.amount > 0 && <span className="text-[13px] tabular-nums text-ink-2">{chf(r.amount)}</span>}
            {r.owner && <span aria-label={r.owner} title={r.owner} className="grid size-7 place-items-center rounded-full bg-bg text-[11px] font-bold text-ink-2">{initials(r.owner)}</span>}
            <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold", STAGE_CLASS[r.stage])}>{STAGES.find((x) => x.value === r.stage)?.label}</span>
          </span>
        </Link>
        <span className="hidden @min-[1024px]:block"><span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold", STAGE_CLASS[r.stage])}>{STAGES.find((x) => x.value === r.stage)?.label}</span></span>
        <span className="hidden text-[14px] tabular-nums @min-[1024px]:block">{r.amount > 0 ? chf(r.amount) : ""}</span>
        <span className="hidden truncate text-[14px] @min-[1024px]:block">{r.owner}</span>
        <span className={cn("hidden text-[14px] tabular-nums @min-[1024px]:block", r.due && "font-semibold text-warn")}>{r.followUp ? fmt(r.followUp) : ""}</span>
        <span className="hidden text-[14px] @min-[1024px]:block">{endText(r)}</span>
      </li>
    );
  };
  const byOwner = useMemo(() => {
    const m = new Map<string, { name: string; total: number; yes: number; open: number; no: number; amount: number }>();
    for (const r of p.rows) {
      const k = r.ownerId || "-";
      const o = m.get(k) ?? { name: r.owner || "Niemand zugeteilt", total: 0, yes: 0, open: 0, no: 0, amount: 0 };
      o.total++;
      if (r.status === "CONFIRMED") o.yes++;
      else if (r.status === "DECLINED") o.no++;
      else o.open++;
      o.amount += r.amount;
      m.set(k, o);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [p.rows]);
  const tasks = mine ? p.tasks.filter((t) => t.assigneeId === p.meId) : p.tasks;

  return (
    <>
      <SponsorNav slug={p.slug} active="" year={p.year} />

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 px-5 pt-4 @min-[1024px]:grid-cols-4">
        <Kpi label="Zugesagt" value={chf(p.totals.committed)} sub={`${counts.CONFIRMED ?? 0} Sponsoren`} hero />
        <Kpi label="Verrechnet" value={chf(p.totals.billed)} sub={p.totals.committed > p.totals.billed ? `${chf(p.totals.committed - p.totals.billed)} noch nicht` : "alles verrechnet"} />
        <Kpi label="Bezahlt" value={chf(p.totals.paid)} sub={p.totals.billed > p.totals.paid ? `${chf(p.totals.billed - p.totals.paid)} offen` : "nichts offen"} />
        <Kpi label="Verlängerungsquote" value={p.totals.renewal == null ? "–" : `${Math.round(p.totals.renewal * 100)} %`} sub={`von ${p.totals.prevCount} Sponsoren ${p.year - 1}`} />
      </section>

      {p.tasks.length > 0 && (
        <section className="card mx-5 mt-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">Aufgaben <span className="text-ink-3">{tasks.length}</span></h2>
            <button type="button" aria-pressed={mine} onClick={() => setMine(!mine)} className={cn(pill, mine ? "bg-ink text-card" : "bg-bg text-ink")}>Nur meine</button>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/c/${p.slug}/admin/sponsoring/${t.sponsorId}`} className="font-semibold">{t.sponsor}</Link>
                  <div className="text-[13.5px] text-ink-2">{t.title}{t.assignee ? ` · ${t.assignee}` : ""}</div>
                </div>
                <button type="button" disabled={pending} onClick={() => start(async () => {
                  const r = await completeTaskAction(p.slug, t.id);
                  if (r.success) router.refresh(); else toast.error(r.error);
                })} className={cn(pill, "bg-bg text-ink")}>Erledigt</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-5 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[22px] font-bold tracking-[-.02em]">Sponsoren</h2>
          <div role="group" aria-label="Ansicht" className="inline-flex rounded-full bg-bg p-0.5">
            {(["board", "list"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => saveView(v)} className={cn("min-h-9 rounded-full px-3.5 text-[13px] font-bold", view === v ? "bg-card text-ink shadow-card" : "text-ink-2")}>{v === "board" ? "Board" : "Liste"}</button>
            ))}
          </div>
          {view === "board" && <button type="button" aria-pressed={selecting} onClick={() => selecting ? stopSelect() : setSelecting(true)} className={cn(pill, selecting ? "bg-ink text-card" : "bg-card text-ink shadow-card")}>{selecting ? "Fertig" : "Auswählen"}</button>}
          <button type="button" onClick={() => setSheet("import")} className={cn(pill, "bg-card text-ink shadow-card")}>Excel importieren</button>
          <button type="button" onClick={() => setSheet("new")} className={cn(pill, "bg-brand-deep text-white")}>+ Sponsor</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma, Kontakt, E-Mail, Ort" aria-label="Suchen"
            className="h-[42px] min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-[15px] outline-none focus-visible:border-clay" />
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Verantwortlich" className="h-[42px] rounded-full border border-border bg-card px-3 text-[14px]">
            <option value="">Alle Verantwortlichen</option>
            {p.board.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={item} onChange={(e) => setItem(e.target.value)} aria-label="Angebot" className="h-[42px] rounded-full border border-border bg-card px-3 text-[14px]">
            <option value="">Alle Angebote</option>
            {p.items.map((it) => <option key={it.id} value={it.id}>{it.name} ({p.rows.filter((r) => r.itemIds.includes(it.id)).length})</option>)}
          </select>
          {view === "list" && <span className="flex gap-2 @min-[1024px]:hidden">
            <select value={sortKey} onChange={(e) => saveSort(e.target.value as SortKey, dir)} aria-label="Sortieren" className="h-[42px] rounded-full border border-border bg-card px-3 text-[14px]">
              {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button type="button" onClick={() => saveSort(sortKey, dir === 1 ? -1 : 1)} aria-label={dir === 1 ? "Aufsteigend, umkehren" : "Absteigend, umkehren"} className="h-[42px] rounded-full border border-border bg-card px-3 text-[14px]">{dir === 1 ? "▲" : "▼"}</button>
          </span>}
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {(["ALL", "NONE", "REQUESTED", "REMINDED", "CONFIRMED", "DECLINED"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className="chip shrink-0">
              {s === "ALL" ? "Alle" : STATUS[s][0]} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto pb-1">
          {STAGES.map((x) => (
            <button key={x.value} type="button" aria-pressed={stage === x.value} onClick={() => setStage(stage === x.value ? "" : x.value)} className="chip shrink-0">{x.label}</button>
          ))}
          {p.meId && <button type="button" aria-pressed={owner === p.meId} onClick={() => setOwner(owner === p.meId ? "" : p.meId)} className="chip shrink-0">Meine</button>}
          {([["due", "Wiedervorlage fällig"], ["end", "endet bald"], ["dun", "Mahnung"], ["nomail", "ohne E-Mail"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={Boolean(flags[k])} onClick={() => setFlags({ ...flags, [k]: !flags[k] })} className="chip shrink-0">{l}</button>
          ))}
        </div>
        {view === "board" && selecting && (
          <label className="mt-2 flex items-center gap-2 px-1 text-[14px] font-semibold">
            <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(list.map((r) => r.id)))} className="size-5 accent-[var(--brand-deep)]" />
            Alle {list.length} (gefilterten) auswählen
          </label>
        )}
        {view === "board" && <SponsorBoard slug={p.slug} rows={list} desktop={desktop} selecting={selecting} picked={picked} onToggle={toggle} onToggleMany={toggleMany} />}
        {view === "list" && dueList.length > 0 && (
          <div className="card mt-3 border border-warn/30 px-0 py-1">
            <h3 className="px-4 pt-2 text-[15px] font-bold text-warn">Wiedervorlage fällig <span className="tabular-nums">{dueList.length}</span></h3>
            <ul className="p-1">{dueList.map(rowEl)}</ul>
          </div>
        )}
        {view === "list" && list.length > 0 && (
          <button type="button" onClick={() => setPicked(allPicked ? new Set() : new Set(list.map((r) => r.id)))} className="mt-2 h-10 px-1 text-[14px] font-semibold text-brand-deep @min-[1024px]:hidden">
            {allPicked ? "Auswahl aufheben" : `Alle ${list.length} auswählen`}
          </button>
        )}
        {view === "list" && <div className="card mt-3 p-1">
          <div className={cn("hidden px-3 py-3 text-[12.5px] font-semibold text-ink-3 @min-[1024px]:grid", "@min-[1024px]:grid-cols-[24px_minmax(0,2.2fr)_120px_100px_minmax(0,1.2fr)_110px_120px] @min-[1024px]:gap-4")}>
            <input type="checkbox" aria-label="Alle angezeigten auswählen" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(list.map((r) => r.id)))} className="h-[18px] w-[18px] accent-brand-deep" />
            {SORTS.map(([k, l]) => (
              <span key={k} role="columnheader" aria-sort={sortKey === k ? (dir === 1 ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => clickSort(k)} className="inline-flex items-center gap-1 text-left font-semibold hover:text-ink">{l}{sortKey === k && <span aria-hidden>{dir === 1 ? "▲" : "▼"}</span>}</button>
              </span>
            ))}
          </div>
          <ul className="divide-y divide-line">
            {restList.map(rowEl)}
            {!list.length && <li className="px-4 py-6 text-center text-[14px] text-ink-3">{p.rows.length ? "Keine Treffer." : "Noch keine Sponsoren. Importieren Sie Ihre Excel-Liste oder erfassen Sie den ersten Sponsor."}</li>}
          </ul>
        </div>}
      </section>

      <section className="card mx-5 mt-6 flex flex-col items-start gap-3 p-5 @min-[640px]:flex-row @min-[640px]:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">Kampagne {p.year}</h2>
          <p className="text-[14px] text-ink-2">
            {p.campaign
              ? `Gestartet am ${new Date(p.campaign.startedAt).toLocaleDateString("de-CH")}. Erinnerung alle ${p.campaign.reminderDays} Tage (max. 2), nach ${p.campaign.taskDays} Tagen ohne Antwort eine Aufgabe für die zuständige Person.`
              : "Noch nicht gestartet. Laufende Verträge werden automatisch verrechnet, alle anderen bekommen ihren persönlichen Link per E-Mail."}
          </p>
        </div>
        <button type="button" onClick={() => setSheet("campaign")} className={cn(pill, p.campaign ? "bg-bg text-ink" : "bg-brand-deep text-white")}>
          {p.campaign ? "Neue Sponsoren anfragen" : `Kampagne ${p.year} starten`}
        </button>
      </section>

      <details className="card mx-5 mt-4 overflow-x-auto p-5">
        <summary className="cursor-pointer text-[17px] font-bold">Pro Verantwortlichem <span className="text-[13px] font-normal text-ink-3">· Name antippen filtert die Liste</span></summary>
        <table className="mt-2 w-full min-w-[480px] text-[14px]">
          <thead className="text-left text-[12px] uppercase tracking-[.06em] text-ink-3">
            <tr><th className="py-1.5 font-bold">Person</th><th className="font-bold">Sponsoren</th><th className="font-bold">Zugesagt</th><th className="font-bold">Offen</th><th className="font-bold">Abgesagt</th><th className="text-right font-bold">Betrag</th></tr>
          </thead>
          <tbody>
            {byOwner.map(([id, o]) => (
              <tr key={id} className="border-t border-line">
                <td className="py-2"><button type="button" onClick={() => setOwner(owner === id ? "" : id)} className="font-semibold text-left">{o.name}</button></td>
                <td className="tabular-nums">{o.total}</td><td className="tabular-nums text-ok">{o.yes}</td><td className="tabular-nums">{o.open}</td><td className="tabular-nums">{o.no}</td>
                <td className="text-right tabular-nums">{chf(o.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {picked.size > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(max(10px,env(safe-area-inset-bottom))+68px)] z-30 flex items-center gap-3 rounded-full bg-ink p-2 pl-5 text-card shadow-card @min-[640px]:bottom-6 @min-[640px]:left-auto @min-[640px]:right-8">
          <span className="text-[14px] font-semibold">{picked.size} gewählt</span>
          <button type="button" onClick={stopSelect} className={cn(pill, "ml-auto bg-white/15 text-card")}>Auswahl aufheben</button>
          <button type="button" onClick={() => setMailOpen(true)} className={cn(pill, "bg-brand-deep text-white")}>Mail an {picked.size} senden</button>
        </div>
      )}
      <SponsorMailSheet open={mailOpen} onClose={() => setMailOpen(false)} slug={p.slug} recipients={recipients} onDone={() => { setMailOpen(false); stopSelect(); }} />
      <NewSponsorSheet open={sheet === "new"} onClose={() => setSheet("")} slug={p.slug} board={p.board} meId={p.meId} />
      <ImportSheet open={sheet === "import"} onClose={() => setSheet("")} slug={p.slug} year={p.year - 1} />
      <CampaignSheet sample={p.sample} open={sheet === "campaign"} onClose={() => setSheet("")} slug={p.slug} year={p.year} campaign={p.campaign} rows={p.rows} />
    </>
  );
}

function Kpi({ label, value, sub, hero }: { label: string; value: string; sub: string; hero?: boolean }) {
  return (
    <div className={cn("card flex flex-col gap-1 p-4", hero && "bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_70%)] text-white")}>
      <span className={cn("text-[13px] font-semibold", hero ? "text-white/85" : "text-ink-3")}>{label}</span>
      <b className="text-[22px] font-bold leading-tight tracking-[-.03em] tabular-nums @min-[640px]:text-[26px]">{value}</b>
      <small className={cn("text-[12.5px]", hero ? "text-white/85" : "text-ink-3")}>{sub}</small>
    </div>
  );
}

function NewSponsorSheet({ open, onClose, slug, board, meId }: { open: boolean; onClose: () => void; slug: string; board: { id: string; name: string }[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Neuer Sponsor">
      <form action={(fd) => start(async () => {
        const r = await saveSponsorAction(slug, {
          name: String(fd.get("name") ?? ""), ownerId: String(fd.get("ownerId") ?? ""),
          contacts: [{ name: String(fd.get("contact") ?? ""), email: String(fd.get("email") ?? ""), isPrimary: true }],
        });
        if (!r.success) return void toast.error(r.error);
        onClose();
        router.push(`/c/${slug}/admin/sponsoring/${r.id}`);
      })} className="grid gap-4">
        <label className={fieldLabel}>Firma<input name="name" required maxLength={120} className={field} /></label>
        <label className={fieldLabel}>Kontaktperson<input name="contact" maxLength={120} className={field} /></label>
        <label className={fieldLabel}>E-Mail<input name="email" type="email" maxLength={200} className={field} /></label>
        <label className={fieldLabel}>Zuständig bei uns
          <select name="ownerId" defaultValue={board.some((b) => b.id === meId) ? meId : ""} className={field}>
            <option value="">Niemand</option>
            {board.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <button disabled={pending} className="btn btn-pri h-[52px] w-full">{pending ? "…" : "Erfassen"}</button>
      </form>
    </Sheet>
  );
}

function ImportSheet({ open, onClose, slug, year }: { open: boolean; onClose: () => void; slug: string; year: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [listYear, setListYear] = useState(year);
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState("");
  const { rows, errors } = useMemo(() => parseSponsors(text), [text]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const buf = await f.arrayBuffer();
    try {
      if (/\.xlsx$/i.test(f.name)) return setText(await xlsxToText(buf));
      try { setText(new TextDecoder("utf-8", { fatal: true }).decode(buf)); } catch { setText(new TextDecoder("windows-1252").decode(buf)); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Datei nicht lesbar.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Sponsoren importieren">
      <div className="text-[24px] font-bold tracking-[-.03em]">Excel-Liste importieren</div>
      <p className="mt-1 text-[14px] text-muted-foreground">
        .xlsx oder CSV wählen, oder Zellen aus Excel einfügen. Erkannte Spalten: Firma, Kontakt, E-Mail, Telefon, Strasse, PLZ, Ort, Website, Verantwortlich, Leistung, Betrag, Jahr, Bemerkung.
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Tipp: zuerst den Katalog erfassen. Leistungen mit gleichem Namen werden als Wahl des Jahres übernommen, damit das Portal «Ihre Wahl {listYear}» zeigt. Gleiche Firma = wird ergänzt, nicht doppelt angelegt.
      </p>
      <label className="btn btn-ghost mt-3 w-full cursor-pointer">Datei wählen<input type="file" accept=".xlsx,.csv,.txt" onChange={pick} className="sr-only" /></label>
      <textarea aria-label="Sponsorenliste" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Firma;Kontakt;E-Mail;Leistung;Betrag"
        className="mt-3 w-full rounded-[15px] border border-border bg-inset p-3 font-mono text-[13px] outline-none focus-visible:border-clay" />
      <label className={cn(fieldLabel, "mt-3")}>Jahr der Liste (wenn keine Spalte «Jahr»)
        <input type="number" value={listYear} onChange={(e) => setListYear(Number(e.target.value))} className={field} />
      </label>
      {text && (
        <p className="mt-3 text-[14px]">
          <b>{rows.length}</b> Sponsoren erkannt{errors.length > 0 && <span className="text-warn"> · {errors.length} Hinweise: {errors.slice(0, 4).map((e) => `Zeile ${e.line}: ${e.reason}`).join("; ")}</span>}
        </p>
      )}
      {summary && <p className="mt-2 rounded-[14px] bg-ok-bg p-3 text-[14px] text-ok">{summary}</p>}
      <button type="button" disabled={!rows.length || pending} className="btn btn-pri mt-4 h-[52px] w-full" onClick={() => start(async () => {
        const r = await importSponsorsAction(slug, text, listYear);
        if (!r.success) return void toast.error(r.error);
        const msg = `${r.created} neu, ${r.updated} ergänzt, ${r.contracts} Wahlen ${listYear} übernommen${r.unmatched.length ? `. Nicht im Katalog: ${r.unmatched.slice(0, 5).join(", ")}` : ""}`;
        setSummary(msg);
        toast.success("Import fertig");
        router.refresh();
      })}>{pending ? "Importiere …" : `${rows.length} importieren`}</button>
    </Sheet>
  );
}

function CampaignSheet({ sample, open, onClose, slug, year, campaign, rows }: {
  sample: boolean; open: boolean; onClose: () => void; slug: string; year: number;
  campaign: { reminderDays: number; taskDays: number } | null; rows: SponsorRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const running = rows.filter((r) => r.status === "CONFIRMED").length;
  const ask = rows.filter((r) => r.status === "NONE").length;
  const noMail = rows.filter((r) => r.status === "NONE" && !r.hasEmail).length;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`Kampagne ${year}`}>
      <div className="text-[24px] font-bold tracking-[-.03em]">{campaign ? "Neue Sponsoren anfragen" : `Kampagne ${year} starten`}</div>
      <ul className="mt-3 grid gap-1.5 text-[14.5px]">
        <li><b>{ask}</b> Sponsoren bekommen jetzt ihren persönlichen Link per E-Mail{noMail ? ` (${noMail} ohne E-Mail → Aufgabe für die zuständige Person)` : ""}.</li>
        <li><b>{running}</b> haben schon zugesagt oder einen laufenden Vertrag: keine Anfrage, die Rechnung geht automatisch raus.</li>
        <li>Wer nicht antwortet, wird automatisch erinnert. Danach bekommt die zuständige Person eine Aufgabe.</li>
      </ul>
      {sample && <SampleWarning slug={slug} />}
      {ask - noMail > 0 && (
        <div role="alert" className="mt-4 rounded-[14px] bg-warn-bg p-3 text-[14px] text-warn">
          <b>Achtung:</b> Beim Starten gehen sofort <b>{ask - noMail} E-Mails</b> an die Sponsoren raus, danach automatisch die Erinnerungen. Das lässt sich nicht rückgängig machen. Bitte vorher Katalog, Preise und Kontakte prüfen.
        </div>
      )}
      <form action={(fd) => start(async () => {
        if (!window.confirm(`Achtung: Das verschickt ECHTE E-Mails an ${ask - noMail} Sponsoren (danach automatisch Erinnerungen), laufende Verträge bekommen ihre Rechnung per Mail. Nicht rückgängig zu machen. Fortfahren?`)) return;
        const r = await startCampaignAction(slug, year, Number(fd.get("reminderDays")), Number(fd.get("taskDays")));
        if (!r.success) return void toast.error(r.error);
        toast.success(r.summary);
        onClose();
        router.refresh();
      })} className="mt-4 grid grid-cols-2 gap-3">
        <label className={fieldLabel}>Erinnern nach (Tagen)<input name="reminderDays" type="number" min={3} max={60} defaultValue={campaign?.reminderDays ?? 14} className={field} /></label>
        <label className={fieldLabel}>Aufgabe nach (Tagen)<input name="taskDays" type="number" min={4} max={120} defaultValue={campaign?.taskDays ?? 35} className={field} /></label>
        <button disabled={pending} className="btn btn-pri col-span-2 h-[52px] w-full">{pending ? "Mails werden verschickt …" : campaign ? "Anfragen" : "Starten und Mails verschicken"}</button>
      </form>
    </Sheet>
  );
}

export function SampleWarning({ slug }: { slug: string }) {
  return (
    <p role="alert" className="mt-3 rounded-[14px] bg-bad-bg p-3 text-[14px] text-bad">
      <b>IBAN oder Clubadresse fehlt.</b> Rechnungen werden erst verschickt, wenn beides erfasst ist.{" "}
      <Link href={`/c/${slug}/admin/settings/zahlungen#rechnungsdaten`} className="font-bold underline">Jetzt ergänzen ›</Link>
    </p>
  );
}
