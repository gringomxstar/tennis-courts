"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STAGES, chf, type Stage } from "@/lib/sponsoring";
import { Sheet } from "@/components/app/sheet";
import { STAGE_CLASS, pill, type SponsorRow } from "@/components/app/admin-sponsoring";
import { addNoteAction, setStageAction } from "@/app/actions/sponsor-crm";

const SORTS = { amount: "Betrag", name: "Name", followUp: "Wiedervorlage", end: "Vertragsende", edited: "Zuletzt bearbeitet" } as const;
type SortKey = keyof typeof SORTS;
const fuTime = (r: SponsorRow) => (r.followUp ? Date.parse(r.followUp) : 1e15);
const CMP: Record<SortKey, (a: SponsorRow, b: SponsorRow) => number> = {
  amount: (a, b) => b.amount - a.amount,
  name: (a, b) => a.name.localeCompare(b.name, "de"),
  followUp: (a, b) => fuTime(a) - fuTime(b),
  end: (a, b) => (a.endsInDays ?? 1e9) - (b.endsInDays ?? 1e9),
  edited: (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
};
const REASONS = ["Budget", "Kein Interesse", "Anderer Verein", "Später wieder"];
const label = (s: Stage) => STAGES.find((x) => x.value === s)!.label;
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const sel = "h-9 rounded-full border border-border bg-card px-3 text-[13px]";
const day = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Zurich" });

export function SponsorBoard(p: {
  slug: string; rows: SponsorRow[]; desktop: boolean; selecting: boolean; picked: Set<string>;
  onToggle: (id: string) => void; onToggleMany: (ids: string[]) => void;
}) {
  const router = useRouter();
  // optimistic stage; reverts by itself when the action fails (transition ends without a new stage)
  const [rows, setRows] = useOptimistic(p.rows, (cur, m: { id: string; stage: Stage }) => cur.map((r) => (r.id === m.id ? { ...r, stage: m.stage } : r)));
  const [, start] = useTransition();
  const [sorts, setSorts] = useState<Partial<Record<Stage, SortKey>>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [over, setOver] = useState<Stage | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [reason, setReason] = useState<{ id: string; name: string; done: () => void } | null>(null);
  const [tab, setTab] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const lp = useRef<{ x: number; y: number; t: ReturnType<typeof setTimeout> } | null>(null);
  const lpFired = useRef(false);

  const move = (r: SponsorRow, to: Stage, undoing = false) => {
    if (r.stage === to) return;
    const from = r.stage;
    start(async () => {
      setRows({ id: r.id, stage: to });
      const res = await setStageAction(p.slug, r.id, to);
      if (!res.success) return void toast.error(res.error);
      if (undoing) return void toast("Rückgängig gemacht");
      const done = () => toast(`${r.name} → ${label(to)}`, { action: { label: "Rückgängig", onClick: () => move({ ...r, stage: to }, from, true) } });
      if (to === "LOST") setReason({ id: r.id, name: r.name, done }); else done();
    });
  };
  const closeReason = () => { const d = reason?.done; setReason(null); d?.(); };
  const saveReason = (why: string) => {
    const id = reason!.id;
    closeReason();
    start(async () => { const r = await addNoteAction(p.slug, id, `Absage-Grund: ${why}`); if (!r.success) toast.error(r.error); });
  };

  const click = (r: SponsorRow) => {
    if (lpFired.current) { lpFired.current = false; return; }
    if (p.selecting) p.onToggle(r.id);
    else if (p.desktop) setOpen(r.id);
    else router.push(`/c/${p.slug}/admin/sponsoring/${r.id}`);
  };
  const lpClear = () => { if (lp.current) clearTimeout(lp.current.t); lp.current = null; };
  const lpDown = (e: React.PointerEvent) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-id]")?.dataset.id;
    if (!id || p.selecting) return;
    lpFired.current = false;
    lp.current = { x: e.clientX, y: e.clientY, t: setTimeout(() => { lpFired.current = true; lp.current = null; navigator.vibrate?.(15); setMoving(id); }, 400) };
  };
  const lpMove = (e: React.PointerEvent) => { if (lp.current && Math.hypot(e.clientX - lp.current.x, e.clientY - lp.current.y) > 8) lpClear(); };

  const badges = (r: SponsorRow) => [
    r.due && ["Wiedervorlage fällig", "bg-warn-bg text-warn"],
    r.endsInDays != null && r.endsInDays <= 90 && [`endet in ${Math.max(0, r.endsInDays)} Tagen`, "bg-brand-tint text-brand-deep"],
    r.dunning > 0 && ["Mahnung", "bg-bad-bg text-bad"],
    !r.hasEmail && ["ohne E-Mail", "bg-bg text-ink-2"],
  ].filter(Boolean) as [string, string][];

  const card = (r: SponsorRow) => {
    const picked = p.picked.has(r.id);
    const b = badges(r);
    return (
      <div key={r.id} role="button" tabIndex={0} data-id={r.id} draggable={p.desktop && !p.selecting}
        onDragStart={(e) => { setDragId(r.id); e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => { setDragId(null); setOver(null); }}
        onClick={() => click(r)} onKeyDown={(e) => e.key === "Enter" && click(r)}
        className={cn("card flex cursor-pointer flex-col gap-1.5 border-2 border-transparent px-3 py-2.5 hover:border-brand-soft",
          !p.desktop && "select-none [-webkit-touch-callout:none]", dragId === r.id && "opacity-40", (picked || open === r.id) && "border-brand-deep", picked && "bg-brand-tint")}>
        <div className="flex items-center gap-2">
          {p.selecting && <input type="checkbox" checked={picked} readOnly tabIndex={-1} aria-label={`${r.name} auswählen`} className="size-[18px] shrink-0 accent-[var(--brand-deep)]" />}
          <b className="min-w-0 flex-1 text-[14px] leading-tight">{r.name}</b>
          {r.owner && <span title={r.owner} className="grid size-[26px] shrink-0 place-items-center rounded-full bg-brand-soft text-[10.5px] font-bold text-brand-deep">{initials(r.owner)}</span>}
        </div>
        {r.amount > 0 && <div className="text-[15px] font-bold tabular-nums text-brand-deep">{chf(r.amount)}</div>}
        {b.length > 0 && <div className="flex flex-wrap gap-1">{b.map(([t, c]) => <span key={t} className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-bold", c)}>{t}</span>)}</div>}
      </div>
    );
  };

  const colOf = (s: Stage) => rows.filter((r) => r.stage === s).sort(CMP[sorts[s] ?? "amount"]);
  const head = (s: Stage, l: SponsorRow[]) => (
    <div className="flex flex-col gap-1.5 px-1 pt-0.5">
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-[22px] items-center rounded-full px-2.5 text-[12px] font-bold", STAGE_CLASS[s])}>{label(s)}</span>
        <b className="text-ink-3">{l.length}</b>
        <span className="flex-1" />
        {p.selecting && l.length > 0 && <button type="button" onClick={() => p.onToggleMany(l.map((r) => r.id))} className="h-6 rounded-full bg-card/80 px-2 text-[12px] font-semibold text-ink-2">Alle</button>}
        {s === "LOST" && p.desktop && <button type="button" title="Einklappen" aria-label="Abgesagt einklappen" onClick={() => setCollapsed(true)} className="h-6 rounded-full bg-card/80 px-2 text-[12px] font-semibold text-ink-2">⇥</button>}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] font-bold tabular-nums text-ink-2">{chf(l.reduce((a, r) => a + r.amount, 0))}</span>
        <select aria-label={`${label(s)} sortieren`} value={sorts[s] ?? "amount"} onChange={(e) => setSorts({ ...sorts, [s]: e.target.value as SortKey })} className="h-7 max-w-[150px] rounded-full border border-border bg-card/80 px-2 text-[12px]">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  );
  const cards = (l: SponsorRow[], cls: string) => (
    <div className={cn("flex flex-col gap-2 overflow-y-auto p-0.5 pb-1.5", cls)}>
      {l.length ? l.map(card) : <div className="py-4 text-center text-[13px] text-ink-3">Keine Karten</div>}
    </div>
  );

  const detail = open ? rows.find((r) => r.id === open) : undefined;
  const moveRow = moving ? rows.find((r) => r.id === moving) : undefined;

  return (
    <>
      {p.desktop ? (
        <div className="mt-3 grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(4,minmax(250px,1fr)) ${collapsed ? "56px" : "260px"}` }}>
          {STAGES.map(({ value: s }) => {
            const l = colOf(s);
            const drop = {
              onDragOver: (e: React.DragEvent) => { if (dragId) { e.preventDefault(); setOver(s); } },
              onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === s ? null : o)); },
              onDrop: (e: React.DragEvent) => { e.preventDefault(); const r = rows.find((x) => x.id === dragId); setOver(null); setDragId(null); if (r) move(r, s); },
            };
            const base = cn("flex min-w-0 flex-col gap-2 rounded-[22px] bg-card/55 p-2.5", over === s && "bg-brand-tint outline-2 outline-dashed outline-brand-deep");
            if (s === "LOST" && collapsed) {
              return (
                <section key={s} {...drop} className={cn(base, "items-center px-0")}>
                  <button type="button" title="Aufklappen" onClick={() => setCollapsed(false)} className="flex h-full w-full flex-col items-center gap-2.5 font-bold text-ink-2">
                    <span className="[writing-mode:vertical-rl]">{label(s)}</span>
                    <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-[12px] font-bold", STAGE_CLASS[s])}>{l.length}</span>
                  </button>
                </section>
              );
            }
            return <section key={s} {...drop} className={base}>{head(s, l)}{cards(l, "max-h-[68vh]")}</section>;
          })}
        </div>
      ) : (
        <>
          <div role="tablist" className="no-scrollbar mt-3 flex gap-1 overflow-x-auto pb-1.5">
            {STAGES.map(({ value: s }, i) => (
              <button key={s} type="button" role="tab" aria-selected={tab === i}
                onClick={() => { setTab(i); const c = track.current?.children[i] as HTMLElement | undefined; if (c) track.current!.scrollTo({ left: c.offsetLeft - (track.current!.clientWidth - c.offsetWidth) / 2, behavior: "smooth" }); }}
                className={cn("h-[34px] shrink-0 rounded-full px-3 text-[13px] font-bold", tab === i ? "bg-ink text-card" : "bg-card/60 text-ink-2")}>
                {label(s)} <b className={tab === i ? "text-card/70" : "text-ink-3"}>{rows.filter((r) => r.stage === s).length}</b>
              </button>
            ))}
          </div>
          <div ref={track} onContextMenu={(e) => e.preventDefault()} onPointerDown={lpDown} onPointerMove={lpMove} onPointerUp={lpClear} onPointerCancel={lpClear} onPointerLeave={lpClear}
            onScroll={(e) => {
              const t = e.currentTarget, mid = t.scrollLeft + t.clientWidth / 2;
              let best = 0, bd = Infinity;
              Array.from(t.children).forEach((c, i) => { const d = Math.abs((c as HTMLElement).offsetLeft + (c as HTMLElement).offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
              if (best !== tab) setTab(best);
            }}
            className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-[7%] [scroll-padding:0_7%]">
            {STAGES.map(({ value: s }) => {
              const l = colOf(s);
              return (
                <section key={s} className="flex min-w-0 flex-[0_0_86%] snap-center flex-col gap-2 rounded-[22px] bg-card/55 p-2.5">
                  {head(s, l)}
                  <div className="px-1 text-[12px] text-ink-3">Lange drücken = verschieben</div>
                  {cards(l, "max-h-[60dvh]")}
                </section>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && setOpen(null)} title="Sponsor">
        {detail && <Detail key={detail.id} r={detail} slug={p.slug} onMove={(s) => move(detail, s)} />}
      </Sheet>

      <Sheet open={Boolean(moveRow)} onOpenChange={(o) => !o && setMoving(null)} title="Verschieben">
        {moveRow && (
          <div className="grid gap-2">
            <div className="text-[22px] font-bold tracking-[-.03em]">Verschieben nach …</div>
            <div className="text-[13px] text-ink-3">{moveRow.name}</div>
            {STAGES.map(({ value: s }) => (
              <button key={s} type="button" onClick={() => { setMoving(null); move(moveRow, s); }}
                className={cn("flex h-12 items-center gap-2.5 rounded-[14px] bg-bg px-3 font-semibold", moveRow.stage === s && "bg-brand-tint outline-2 outline-brand-deep")}>
                <span className={cn("inline-flex h-[22px] items-center rounded-full px-2.5 text-[12px] font-bold", STAGE_CLASS[s])}>{label(s)}</span>
                {moveRow.stage === s && <span className="text-[13px] text-ink-2">aktuell</span>}
                <span className="ml-auto text-ink-3">{rows.filter((r) => r.stage === s).length}</span>
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={Boolean(reason)} onOpenChange={(o) => !o && closeReason()} title="Absage-Grund">
        {reason && (
          <div className="grid gap-3">
            <div className="text-[22px] font-bold tracking-[-.03em]">Grund für die Absage?</div>
            <div className="text-[13px] text-ink-3">{reason.name} · optional</div>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((x) => <button key={x} type="button" onClick={() => saveReason(x)} className="chip">{x}</button>)}
            </div>
            <button type="button" onClick={closeReason} className={cn(pill, "bg-bg text-ink")}>Überspringen</button>
          </div>
        )}
      </Sheet>
    </>
  );
}

function Detail({ r, slug, onMove }: { r: SponsorRow; slug: string; onMove: (s: Stage) => void }) {
  const [text, setText] = useState("");
  const [fu, setFu] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [pending, start] = useTransition();
  const ahead = (days: number, months = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); };
  const opts: [string, string][] = [["1 Woche", ahead(7)], ["1 Monat", ahead(0, 1)], ["3 Monate", ahead(0, 3)]];
  return (
    <div className="grid gap-4">
      <div>
        <span className={cn("inline-flex h-[22px] items-center rounded-full px-2.5 text-[12px] font-bold", STAGE_CLASS[r.stage])}>{label(r.stage)}</span>
        <h2 className="mt-1.5 text-[20px] font-bold leading-tight">{r.name}</h2>
        {r.amount > 0 && <div className="font-bold tabular-nums text-brand-deep">{chf(r.amount)}</div>}
      </div>
      <label className="grid gap-1 text-[12px] font-bold uppercase tracking-[.04em] text-ink-3">Stufe
        <select value={r.stage} onChange={(e) => onMove(e.target.value as Stage)} className={cn(sel, "h-10 text-[14px] normal-case tracking-normal text-ink")}>
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <div className="grid gap-0.5 text-[14px]">
        <div className="text-[12px] font-bold uppercase tracking-[.04em] text-ink-3">Hauptkontakt</div>
        <div>{r.contact || "–"}</div>
        {r.email ? <a href={`mailto:${r.email}`} className="font-semibold text-brand-deep underline">{r.email}</a> : <span className="text-ink-3">ohne E-Mail</span>}
        {r.phone && <a href={`tel:${r.phone.replace(/\s+/g, "")}`} className="font-semibold text-brand-deep underline">{r.phone}</a>}
      </div>
      <div>
        <div className="text-[12px] font-bold uppercase tracking-[.04em] text-ink-3">Letzte Notiz</div>
        {r.lastNote
          ? <div className="mt-1 rounded-[12px] bg-bg px-3 py-2 text-[13.5px]"><span className="text-[12.5px] text-ink-3">{day(r.lastNote.at)}</span><br /><span className="line-clamp-4 whitespace-pre-wrap">{r.lastNote.text}</span></div>
          : <div className="text-[13.5px] text-ink-3">Noch keine.</div>}
      </div>
      <div className="grid gap-2">
        <div className="text-[12px] font-bold uppercase tracking-[.04em] text-ink-3">Notiz erfassen</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} aria-label="Notiz" placeholder="Was wurde besprochen?" className="w-full resize-none rounded-[12px] border border-border bg-inset px-3 py-2 text-[14px] outline-none focus-visible:border-clay" />
        <div className="text-[12px] font-bold uppercase tracking-[.04em] text-ink-3">Wiedervorlage</div>
        <div className="flex flex-wrap items-center gap-2">
          {opts.map(([l, v]) => <button key={l} type="button" aria-pressed={fu === v && !custom} onClick={() => { setCustom(false); setFu(fu === v ? null : v); }} className="chip">{l}</button>)}
          <button type="button" aria-pressed={custom} onClick={() => { setCustom(!custom); if (custom) setFu(null); }} className="chip">Datum…</button>
          {custom && <input type="date" aria-label="Datum der Wiedervorlage" value={fu ?? ""} onChange={(e) => setFu(e.target.value || null)} className={sel} />}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={pending || !text.trim()} onClick={() => start(async () => {
          const res = await addNoteAction(slug, r.id, text, fu);
          if (!res.success) return void toast.error(res.error);
          toast.success(fu ? "Notiz gespeichert, Wiedervorlage gesetzt" : "Notiz gespeichert");
          setText(""); setFu(null); setCustom(false);
        })} className={cn(pill, "bg-brand-deep text-white disabled:opacity-45")}>{pending ? "…" : "Notiz speichern"}</button>
        <Link href={`/c/${slug}/admin/sponsoring/${r.id}`} className="ml-auto font-bold text-brand-deep underline underline-offset-4">Ganze Karte öffnen</Link>
      </div>
    </div>
  );
}
