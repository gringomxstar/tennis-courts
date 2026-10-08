"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/app/confirm-button";
import { field, pill } from "@/components/app/admin-sponsoring";
import {
  addNoteAction, completeFollowUpAction, deleteNoteAction, deleteSponsorFileAction, updateNoteAction, uploadSponsorFileAction,
} from "@/app/actions/sponsor-crm";

export type Note = { id: string; text: string; author: string; mine: boolean; at: string; followUp: string; done: boolean; due: boolean };
export type SponsorFileRow = { id: string; name: string; size: number; at: string };

const de = (iso: string) => new Date(iso).toLocaleDateString("de-CH");
const ymd = (d: Date) => d.toLocaleDateString("sv-SE");
const inDays = (days: number, months = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() + days);
  return ymd(d);
};
const CHIPS: [string, string][] = [["1 Woche", inDays(7)], ["1 Monat", inDays(0, 1)], ["3 Monate", inDays(0, 3)]];
const MAX_PDF = 3 * 1024 * 1024;

type Run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string, after?: () => void) => void;

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run: Run = (fn, ok, after) => start(async () => {
    const r = await fn().catch(() => ({ success: false, error: "Verbindung fehlgeschlagen." }));
    if (!r.success) return void toast.error(r.error ?? "Fehler");
    if (ok) toast.success(ok);
    after?.();
    router.refresh();
  });
  return { pending, run };
}

export function SponsorFiles({ slug, sponsorId, files }: { slug: string; sponsorId: string; files: SponsorFileRow[] }) {
  const { pending, run } = useRun();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-3">
      <ul className="grid gap-1.5">
        {files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-[14px] bg-bg px-3 py-2 text-[14px]">
            <span className="min-w-0 flex-1 basis-40 truncate font-semibold">{f.name}</span>
            <span className="text-[12.5px] text-ink-3">{f.size < 1048576 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1048576).toFixed(1)} MB`} · {de(f.at)}</span>
            <a href={`/c/${slug}/admin/sponsoring/datei/${f.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-deep">ansehen</a>
            <ConfirmButton disabled={pending} onConfirm={() => run(() => deleteSponsorFileAction(slug, f.id), "Datei gelöscht")} confirm="Löschen?" className="font-semibold text-bad">löschen</ConfirmButton>
          </li>
        ))}
      </ul>
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > MAX_PDF) return void toast.error("Datei grösser als 3 MB.");
        const fd = new FormData();
        fd.set("file", file);
        run(() => uploadSponsorFileAction(slug, sponsorId, fd), "Hochgeladen");
      }} />
      <button type="button" disabled={pending} onClick={() => input.current?.click()} className={cn(pill, "mt-2 bg-bg text-ink")}>{pending ? "…" : "Vertrag (PDF) hochladen"}</button>
    </div>
  );
}

export function SponsorNotes({ slug, sponsorId, notes }: { slug: string; sponsorId: string; notes: Note[] }) {
  const { pending, run } = useRun();
  const [text, setText] = useState("");
  const [at, setAt] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [edit, setEdit] = useState<{ id: string; text: string; at: string } | null>(null);
  const chip = (on: boolean) => cn(pill, on ? "bg-brand-deep text-white" : "bg-bg text-ink");
  return (
    <section className="card p-5">
      <h2 className="text-[17px] font-bold">Notizen</h2>
      <form className="mt-2 grid gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) run(() => addNoteAction(slug, sponsorId, text, at || null), "Notiz gespeichert", () => { setText(""); setAt(""); setDateOpen(false); });
      }}>
        <textarea id="sponsor-note-input" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} placeholder="Telefonat, Absprache, Idee …" aria-label="Neue Notiz" className={cn(field, "mt-0 h-auto py-3")} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-3">Wiedervorlage:</span>
          {CHIPS.map(([l, d]) => (
            <button key={l} type="button" onClick={() => { setAt(at === d ? "" : d); setDateOpen(false); }} className={chip(at === d)}>{l}</button>
          ))}
          <button type="button" onClick={() => setDateOpen(true)} className={chip(dateOpen || (Boolean(at) && !CHIPS.some(([, d]) => d === at)))}>
            {at && !CHIPS.some(([, d]) => d === at) ? de(at) : "Datum…"}
          </button>
          {dateOpen && <input type="date" value={at} min={ymd(new Date())} onChange={(e) => setAt(e.target.value)} aria-label="Wiedervorlage-Datum" className={cn(field, "mt-0 h-9 w-auto")} />}
        </div>
        <button disabled={pending || !text.trim()} className="btn btn-pri h-[46px] w-full">{pending ? "…" : at ? `Speichern · Wiedervorlage ${de(at)}` : "Speichern"}</button>
      </form>

      <ul className="mt-3 divide-y divide-line">
        {notes.map((n) => (
          <li key={n.id} className="py-3 text-[14.5px]">
            <div className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-3">
              <span className="tabular-nums">{de(n.at)}</span><span>· {n.author}</span>
              {n.mine && !edit && (
                <span className="ml-auto flex gap-3">
                  <button type="button" onClick={() => setEdit({ id: n.id, text: n.text, at: n.followUp ? ymd(new Date(n.followUp)) : "" })} className="font-semibold text-ink-2">Bearbeiten</button>
                  <ConfirmButton disabled={pending} onConfirm={() => run(() => deleteNoteAction(slug, n.id), "Notiz gelöscht")} confirm="Löschen?" className="font-semibold text-bad">Löschen</ConfirmButton>
                </span>
              )}
            </div>
            {edit?.id === n.id ? (
              <div className="mt-1 grid gap-2">
                <textarea value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} rows={3} maxLength={4000} aria-label="Notiz bearbeiten" className={cn(field, "mt-0 h-auto py-3")} />
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={edit.at} onChange={(e) => setEdit({ ...edit, at: e.target.value })} aria-label="Wiedervorlage-Datum" className={cn(field, "mt-0 h-9 w-auto")} />
                  <button type="button" disabled={pending || !edit.text.trim()} onClick={() => run(() => updateNoteAction(slug, n.id, edit.text, edit.at || null), "Gespeichert", () => setEdit(null))} className={cn(pill, "ml-auto bg-brand-deep text-white")}>Speichern</button>
                  <button type="button" onClick={() => setEdit(null)} className={cn(pill, "bg-bg text-ink")}>Abbrechen</button>
                </div>
              </div>
            ) : <p className="mt-0.5 whitespace-pre-wrap">{n.text}</p>}
            {n.followUp && edit?.id !== n.id && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", n.done ? "bg-ok-bg text-ok" : n.due ? "bg-warn-bg text-warn" : "bg-bg text-ink-2")}>
                  {n.done ? `Wiedervorlage ${de(n.followUp)} erledigt` : `${n.due ? "Fällig" : "Wiedervorlage"} ${de(n.followUp)}`}
                </span>
                {!n.done && <button type="button" disabled={pending} onClick={() => run(() => completeFollowUpAction(slug, n.id), "Erledigt")} className={cn(pill, "bg-card text-ink")}>Erledigt</button>}
              </div>
            )}
          </li>
        ))}
        {!notes.length && <li className="py-2 text-[14px] text-ink-3">Noch keine Notiz.</li>}
      </ul>
    </section>
  );
}
