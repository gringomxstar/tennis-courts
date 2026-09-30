"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Court } from "@/types";
import { createCoachBlockAction, editCoachCourseAction, cancelSeriesAction } from "@/app/actions/booking";
import { Spinner } from "@/components/app/avatar";
import { cn } from "@/lib/utils";

const field =
  "mt-1.5 h-[46px] w-full min-w-0 rounded-[14px] border border-transparent bg-bg px-3 text-[16px] text-foreground outline-none focus-visible:border-clay";
const cap = "block text-[12.5px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type Line = { courtId: string; time: string; hours: number };
export type CourseSummary = {
  kursId: string;
  /** any booking of the course, for cancelSeriesAction */
  bookingId: string;
  name: string;
  count: number;
  next: string;
  courts: { courtId: string; minutes: number; count: number }[];
};

const dayStr = (d: Date) => d.toLocaleDateString("sv-SE");

/** Trainer: Kurs = Name + Wochentage + Zeitraum + Plätze (je eigene Zeit/Dauer). Alles oder nichts. */
export function CoachBlockForm({ slug, courts, courses }: { slug: string; courts: Court[]; courses: CourseSummary[] }) {
  const router = useRouter();
  const today = dayStr(new Date());
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState(today);
  const [lines, setLines] = useState<Line[]>([{ courtId: courts[0]?.id ?? "", time: "17:00", hours: 1 }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => {
    const last = lines[lines.length - 1];
    const next = courts[(courts.findIndex((c) => c.id === last.courtId) + 1) % courts.length]?.id;
    setLines([...lines, { ...last, courtId: next ?? last.courtId }]);
  };
  const dates: string[] = [];
  for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${until}T12:00:00`) && dates.length < 400; d.setDate(d.getDate() + 1)) {
    if (days.includes((d.getDay() + 6) % 7)) dates.push(dayStr(d));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!days.length) return setMsg({ ok: false, text: "Bitte mindestens einen Wochentag wählen." });
    if (!dates.length) return setMsg({ ok: false, text: "Im Zeitraum liegt kein gewählter Wochentag." });
    setBusy(true);
    setMsg(null);
    const res = await createCoachBlockAction({
      clubSlug: slug,
      name,
      items: dates.flatMap((date) =>
        lines.map((l) => ({ courtId: l.courtId, startsAt: new Date(`${date}T${l.time}`).toISOString(), durationMinutes: Math.round(l.hours * 60) }))
      ),
    });
    setBusy(false);
    if (!res.success) return setMsg({ ok: false, text: res.error });
    setMsg({ ok: true, text: `${res.created} Termine gebucht.` });
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-5 pb-8 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2">
      <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
        <h1 className="text-[22px] font-bold tracking-[-.02em]">Kurs buchen</h1>
        <label>
          <span className={cap}>Kursname</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Juniorenkurs" maxLength={80} required />
        </label>

        <div>
          <span className={cap}>Wochentage</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {WD.map((w, i) => (
              <button
                key={w}
                type="button"
                aria-pressed={days.includes(i)}
                onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
                className={cn("chip h-10 min-w-12 justify-center", days.includes(i) && "bg-brand-deep text-white")}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={cap}>Von</span>
            <input type="date" className={field} value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (until < e.target.value) setUntil(e.target.value); }} required />
          </label>
          <label>
            <span className={cap}>Bis</span>
            <input type="date" className={field} value={until} min={from} onChange={(e) => setUntil(e.target.value)} required />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className={cap}>Plätze</span>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1.4fr_1fr_.8fr_auto] items-end gap-2">
              <select aria-label="Platz" className={field} value={l.courtId} onChange={(e) => setLine(i, { courtId: e.target.value })}>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input aria-label="Start" type="time" step={1800} className={field} value={l.time} onChange={(e) => setLine(i, { time: e.target.value })} required />
              <input aria-label="Stunden" type="number" min={0.5} max={8} step={0.5} className={field} value={l.hours} onChange={(e) => setLine(i, { hours: Number(e.target.value) })} required />
              {lines.length > 1 ? (
                <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={`Platz ${i + 1} entfernen`} className="btn btn-ghost !h-[46px] text-bad">
                  ×
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <button type="button" onClick={addLine} className="btn btn-ghost h-10 self-start">
            + Platz hinzufügen
          </button>
        </div>

        {msg && <p role="status" className={msg.ok ? "text-[14px] font-semibold text-brand-deep" : "text-[14px] font-semibold text-bad"}>{msg.text}</p>}
        <button type="submit" disabled={busy || !courts.length} className="btn btn-primary h-12">
          {busy ? <Spinner /> : `Kurs buchen (${dates.length * lines.length} Termine, gratis)`}
        </button>
      </form>

      {courses.map((c) => (
        <Course key={c.kursId} slug={slug} c={c} courts={courts} />
      ))}
    </div>
  );
}

/** Bestehender Kurs: Name ändern, je Platz Dauer ändern oder streichen (alle künftigen Termine), Kurs absagen. */
function Course({ slug, c, courts }: { slug: string; c: CourseSummary; courts: Court[] }) {
  const router = useRouter();
  const [name, setName] = useState(c.name);
  const [mins, setMins] = useState(Object.fromEntries(c.courts.map((x) => [x.courtId, x.minutes / 60])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const courtName = (id: string) => courts.find((x) => x.id === id)?.name ?? "Platz";

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setMsg(res.success ? ok : (res.error ?? "Fehlgeschlagen"));
    if (res.success) router.refresh();
  }
  const save = () =>
    run(
      () =>
        editCoachCourseAction({
          clubSlug: slug,
          kursId: c.kursId,
          name,
          courts: c.courts.map((x) => ({ courtId: x.courtId, minutes: Math.round((mins[x.courtId] ?? x.minutes / 60) * 60) })),
        }),
      "Gespeichert."
    );

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-.02em]">{c.name}</h2>
        <div className="text-[13px] text-ink-3">
          {c.count} künftige Termine, nächster {new Date(c.next).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "numeric" })}
        </div>
      </div>
      <label>
        <span className={cap}>Kursname</span>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </label>
      {c.courts.map((x) => (
        <div key={x.courtId} className="grid grid-cols-[1fr_.7fr_auto] items-end gap-2">
          <div className="pb-3 text-[15px] font-semibold">
            {courtName(x.courtId)} <span className="text-[12.5px] font-normal text-ink-3">({x.count}×)</span>
          </div>
          <input aria-label={`Stunden ${courtName(x.courtId)}`} type="number" min={0.5} max={8} step={0.5} className={field} value={mins[x.courtId]} onChange={(e) => setMins({ ...mins, [x.courtId]: Number(e.target.value) })} />
          <button
            type="button"
            disabled={busy || c.courts.length < 2}
            onClick={() => run(() => editCoachCourseAction({ clubSlug: slug, kursId: c.kursId, courts: [{ courtId: x.courtId, remove: true }] }), "Platz gestrichen.")}
            className="btn btn-ghost !h-[46px] text-bad"
            aria-label={`${courtName(x.courtId)} streichen`}
          >
            ×
          </button>
        </div>
      ))}
      {msg && <p role="status" className="text-[14px] font-semibold">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={save} className="btn btn-primary h-11">
          Speichern
        </button>
        <button type="button" disabled={busy} onClick={() => confirm("Ganzen Kurs absagen?") && run(() => cancelSeriesAction(c.bookingId, slug), "Kurs abgesagt.")} className="btn h-11 text-bad">
          Ganzen Kurs absagen
        </button>
      </div>
    </section>
  );
}
