"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { field, fieldLabel } from "@/components/app/admin-sponsoring";
import type { Opt } from "@/components/app/admin-events";
import { saveEventAction } from "@/app/actions/events";
import { EVENT_TEMPLATES } from "@/lib/events";
import { cn } from "@/lib/utils";

export type EventForm = {
  id?: string; kind: string; title: string; date: string; time: string; endTime: string; location: string; description: string;
  priceNote: string; deadline: string; maxSeats: string; maxPlusOnes: string; courtIds: string[]; mailMembers: boolean;
};

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const addDays = (day: string, n: number) => new Date(Date.parse(day + "T12:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
export const chip = "chip bg-bg shadow-none aria-pressed:bg-ink aria-pressed:text-card aria-pressed:shadow-none";
const area = "mt-1.5 w-full rounded-[15px] border border-border bg-inset p-3 text-[16px] outline-none focus-visible:border-clay";

const emptyForm = (): EventForm => ({
  kind: "leer", title: "", date: "", time: "18:00", endTime: "20:00", location: "", description: "", priceNote: "", deadline: "",
  maxSeats: "", maxPlusOnes: "0", courtIds: [], mailMembers: true,
});

/** Erfassen/Bearbeiten als Seite. Speichert nur, verschickt nie. */
export function EventEditor({ slug, courts, initial }: { slug: string; courts: Opt[]; initial?: EventForm }) {
  const router = useRouter();
  const [f, setF] = useState<EventForm>(initial ?? emptyForm());
  const [pending, start] = useTransition();
  const editing = Boolean(initial);
  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleIn = (l: string[], id: string) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]);

  function template(id: keyof typeof EVENT_TEMPLATES) {
    const t = EVENT_TEMPLATES[id];
    const start = Number(f.time.slice(0, 2)) * 60 + Number(f.time.slice(3, 5));
    setF((x) => ({
      ...x, kind: id, title: t.title || x.title, endTime: hhmm(Math.min(start + t.durationMin, 23 * 60 + 59)),
      deadline: x.date ? addDays(x.date, -t.deadlineDays) : x.deadline, maxSeats: t.maxSeats ? String(t.maxSeats) : "", maxPlusOnes: String(t.maxPlusOnes),
      courtIds: t.blockCourts === "all" ? courts.map((c) => c.id) : [],
    }));
  }

  function save() {
    start(async () => {
      const r = await saveEventAction(slug, { ...f, maxSeats: Number(f.maxSeats) || null, maxPlusOnes: Number(f.maxPlusOnes) || 0 });
      if (!r.success) return void toast.error(r.error);
      if (r.conflict) toast.warning(`Gespeichert, Plätze aber nicht gesperrt: ${r.conflict}`); else toast("Gespeichert");
      router.push(`/c/${slug}/admin/events/${r.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 @min-[640px]:gap-4 @min-[640px]:px-0 @min-[640px]:pt-0">
      <Link href={initial?.id ? `/c/${slug}/admin/events/${initial.id}` : `/c/${slug}/admin/events`} className="h-8 text-[14px] font-semibold text-brand-deep">‹ Anlässe</Link>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="card flex flex-col gap-3 p-4 @min-[640px]:p-5">
        <h1 className="text-[24px] font-bold tracking-[-.03em]">{editing ? "Anlass bearbeiten" : "Neuer Anlass"}</h1>
        <div className="grid gap-x-8 gap-y-3 @min-[1024px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @min-[1024px]:items-start">
          <div className="grid gap-3">
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
              {(Object.keys(EVENT_TEMPLATES) as (keyof typeof EVENT_TEMPLATES)[]).map((id) => (
                <button key={id} type="button" aria-pressed={f.kind === id} onClick={() => template(id)} className={chip}>{EVENT_TEMPLATES[id].label}</button>
              ))}
            </div>
            <label className={fieldLabel}>Titel<input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} className={field} /></label>
            <div className="grid grid-cols-3 gap-2">
              <label className={cn(fieldLabel, "col-span-3 min-[420px]:col-span-1")}>Datum<input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={field} /></label>
              <label className={fieldLabel}>Von<input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className={field} /></label>
              <label className={fieldLabel}>Bis<input type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} className={field} /></label>
            </div>
            <label className={fieldLabel}>Ort<input value={f.location} onChange={(e) => set("location", e.target.value)} maxLength={200} className={field} /></label>
            <label className={fieldLabel}>Text<textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={4000} className={area} /></label>
            <label className={fieldLabel}>Kosten (Text, Bezahlung vor Ort)<input value={f.priceNote} onChange={(e) => set("priceNote", e.target.value)} maxLength={200} placeholder="z. B. CHF 25 pro Person" className={field} /></label>
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2 @min-[1024px]:grid-cols-1">
              <label className={cn(fieldLabel, "col-span-3 min-[420px]:col-span-1 @min-[1024px]:col-span-1")}>Anmeldeschluss<input type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} className={field} /></label>
              <label className={fieldLabel}>Max. Plätze<input type="number" min={0} inputMode="numeric" value={f.maxSeats} onChange={(e) => set("maxSeats", e.target.value)} placeholder="offen" className={field} /></label>
              <label className={fieldLabel}>Begleitung<input type="number" min={0} max={10} inputMode="numeric" value={f.maxPlusOnes} onChange={(e) => set("maxPlusOnes", e.target.value)} className={field} /></label>
            </div>
            {courts.length > 0 && (
              <div>
                <div className={fieldLabel}>Plätze sperren</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => set("courtIds", f.courtIds.length === courts.length ? [] : courts.map((c) => c.id))} className="chip bg-bg shadow-none">{f.courtIds.length === courts.length ? "Keine" : "Alle"}</button>
                  {courts.map((c) => <button key={c.id} type="button" aria-pressed={f.courtIds.includes(c.id)} onClick={() => set("courtIds", toggleIn(f.courtIds, c.id))} className={chip}>{c.name}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-[calc(max(10px,env(safe-area-inset-bottom))+84px)] z-20 -mx-1 rounded-[20px] bg-card/90 p-1 backdrop-blur @min-[640px]:static @min-[640px]:mx-0 @min-[640px]:bg-transparent @min-[640px]:p-0 @min-[640px]:backdrop-blur-none">
          <button type="submit" disabled={pending || !f.title.trim() || !f.date} className="btn btn-pri h-[52px] w-full @min-[1024px]:ml-auto @min-[1024px]:w-[220px]">{pending ? "Speichere …" : "Speichern"}</button>
        </div>
      </form>
    </div>
  );
}
