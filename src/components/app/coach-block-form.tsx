"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Court } from "@/types";
import { createCoachBlockAction } from "@/app/actions/booking";
import { Spinner } from "@/components/app/avatar";

const field =
  "mt-1.5 h-[46px] w-full min-w-0 rounded-[14px] border border-transparent bg-bg px-3 text-[16px] text-foreground outline-none focus-visible:border-clay";
const cap = "block text-[12.5px] font-bold uppercase tracking-[.06em] text-muted-foreground";

type Row = { courtId: string; date: string; time: string; hours: number };

/** Trainer: Kursname + beliebig viele Zeilen (Platz, Datum, Start, Dauer). Alles oder nichts. */
export function CoachBlockForm({ slug, courts }: { slug: string; courts: Court[] }) {
  const router = useRouter();
  const today = new Date().toLocaleDateString("sv-SE");
  const blank = (courtId = courts[0]?.id ?? ""): Row => ({ courtId, date: today, time: "17:00", hours: 2 });
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // neue Zeile übernimmt Datum, Zeit und Dauer der letzten, nächster Platz
  const add = () => {
    const last = rows[rows.length - 1];
    const next = courts[(courts.findIndex((c) => c.id === last.courtId) + 1) % courts.length]?.id;
    setRows([...rows, { ...last, courtId: next ?? last.courtId }]);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await createCoachBlockAction({
      clubSlug: slug,
      name,
      items: rows.map((r) => ({ courtId: r.courtId, startsAt: new Date(`${r.date}T${r.time}`).toISOString(), durationMinutes: Math.round(r.hours * 60) })),
    });
    setBusy(false);
    if (!res.success) return setMsg({ ok: false, text: res.error });
    setMsg({ ok: true, text: `${res.created} Plätze gebucht.` });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mx-auto flex max-w-[640px] flex-col gap-4 p-5">
      <h1 className="text-[22px] font-bold tracking-[-.02em]">Kurs buchen</h1>
      <label>
        <span className={cap}>Kursname</span>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Juniorenkurs" maxLength={80} required />
      </label>

      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-[1.3fr_1.3fr_1fr_.8fr_auto]">
          <label>
            <span className={cap}>Platz</span>
            <select className={field} value={r.courtId} onChange={(e) => set(i, { courtId: e.target.value })}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={cap}>Datum</span>
            <input type="date" className={field} value={r.date} min={today} onChange={(e) => set(i, { date: e.target.value })} required />
          </label>
          <label>
            <span className={cap}>Start</span>
            <input type="time" step={1800} className={field} value={r.time} onChange={(e) => set(i, { time: e.target.value })} required />
          </label>
          <label>
            <span className={cap}>Stunden</span>
            <input type="number" min={0.5} max={8} step={0.5} className={field} value={r.hours} onChange={(e) => set(i, { hours: Number(e.target.value) })} required />
          </label>
          {rows.length > 1 && (
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Zeile ${i + 1} entfernen`} className="btn btn-ghost !h-[46px] self-end text-bad">
              ×
            </button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={add} className="btn btn-ghost h-10">
          + Platz hinzufügen
        </button>
        {rows.length > 1 && (
          <button type="button" onClick={() => setRows(rows.map((r) => ({ ...blank(r.courtId), date: rows[0].date, time: rows[0].time, hours: rows[0].hours })))} className="btn btn-ghost h-10">
            Zeit der ersten auf alle
          </button>
        )}
      </div>

      {msg && <p role="status" className={msg.ok ? "text-[14px] font-semibold text-brand-deep" : "text-[14px] font-semibold text-bad"}>{msg.text}</p>}
      <button type="submit" disabled={busy || !courts.length} className="btn btn-primary h-12">
        {busy ? <Spinner /> : `Kurs buchen (${rows.length} ${rows.length === 1 ? "Platz" : "Plätze"}, gratis)`}
      </button>
    </form>
  );
}
