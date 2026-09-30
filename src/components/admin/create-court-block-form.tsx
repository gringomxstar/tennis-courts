"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Court, BlockReason, CourtBlock } from "@/types";
import { createCourtBlockAction, updateCourtBlockAction } from "@/app/actions/booking";
import { cn } from "@/lib/utils";
import { Dot, Spinner } from "@/components/app/avatar";
import { courtColor, courtLabel, SURFACE_COLOR, SURFACE_LABEL, surfaceKind, type SurfaceKind } from "@/lib/courts";

const Tick = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

const label = "block truncate text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[14px] border border-transparent bg-bg px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-clay";

interface CreateCourtBlockFormProps {
  clubSlug: string;
  courts: Court[];
  /** edit this one block instead of creating new ones */
  edit?: CourtBlock;
  onDone?: () => void;
}

const hm = (d: Date) => d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });

export function CreateCourtBlockForm({ clubSlug, courts, edit, onDone }: CreateCourtBlockFormProps) {
  const router = useRouter();
  const todayStr = new Date().toLocaleDateString("sv-SE"); // local YYYY-MM-DD
  const from = edit ? new Date(edit.startsAt) : null;
  const to = edit ? new Date(edit.endsAt) : null;
  const [courtIds, setCourtIds] = useState<string[]>(edit ? [edit.courtId] : []);
  const [dateStr, setDateStr] = useState(from ? from.toLocaleDateString("sv-SE") : todayStr);
  const [endDateStr, setEndDateStr] = useState(from ? from.toLocaleDateString("sv-SE") : todayStr);
  const [startTime, setStartTime] = useState(from ? hm(from) : "08:00");
  const [endTime, setEndTime] = useState(to ? hm(to) : "12:00");
  const [reason, setReason] = useState<BlockReason>(edit?.reason ?? "MAINTENANCE");
  const [description, setDescription] = useState(edit?.description ?? "");
  const all = courtIds.length === courts.length;
  // quick picks by surface: rain and winter closures hit all clay courts at once
  const kinds = (["clay", "hard", "padel"] as const).filter((k) => courts.some((c) => surfaceKind(c) === k));
  const ofKind = (k: SurfaceKind) => courts.filter((c) => surfaceKind(c) === k).map((c) => c.id);
  const kindOn = (k: SurfaceKind) => ofKind(k).every((id) => courtIds.includes(id));
  const toggleKind = (k: SurfaceKind) =>
    setCourtIds(kindOn(k) ? courtIds.filter((id) => !ofKind(k).includes(id)) : [...new Set([...courtIds, ...ofKind(k)])]);
  const toggleCourt = (id: string) =>
    edit ? setCourtIds([id]) : setCourtIds(courtIds.includes(id) ? courtIds.filter((x) => x !== id) : [...courtIds, id]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    // one block per day and court, so "08–12 from Mon to Wed" doesn't block the nights in between
    const days: string[] = [];
    for (let d = new Date(`${dateStr}T12:00:00`); d <= new Date(`${endDateStr}T12:00:00`); d.setDate(d.getDate() + 1)) {
      days.push(d.toLocaleDateString("sv-SE"));
    }
    if (!days.length || days.length > 90 || endTime <= startTime) {
      setMessage({ type: "error", text: "Bitte gültigen Zeitraum wählen (max. 90 Tage, Bis nach Von)." });
      return;
    }
    const ids = courtIds;
    if (!ids.length) {
      setMessage({ type: "error", text: "Bitte mindestens einen Platz wählen." });
      return;
    }

    const items = days.flatMap((day) =>
      ids.map((id) => ({
        courtId: id,
        startsAt: new Date(`${day}T${startTime}:00`).toISOString(),
        endsAt: new Date(`${day}T${endTime}:00`).toISOString(),
      }))
    );

    setLoading(true);
    const res = await (edit
      ? updateCourtBlockAction({ clubSlug, blockId: edit.id, ...items[0], reason, description })
      : createCourtBlockAction({ clubSlug, items, reason, description: description.trim() || undefined })
    ).catch(
      () => ({ success: false, error: "Verbindung fehlgeschlagen." })
    );
    setLoading(false);
    if (!res.success) {
      setMessage({ type: "error", text: res.error || "Fehler beim Erstellen der Platzsperre." });
    } else {
      setMessage({ type: "success", text: edit ? "Sperre gespeichert." : items.length === 1 ? "Sperre erfasst." : `${items.length} Sperren erfasst.` });
      if (!edit) setDescription("");
    }
    router.refresh();
    if (res.success) onDone?.();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
      {message && (
        <div
          role="status"
          className={`rounded-[18px] px-4 py-3 text-[15px] font-semibold ${
            message.type === "success" ? "bg-paid-bg text-paid-fg" : "bg-clay text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      <fieldset>
        <legend className={label}>{edit ? "Platz" : `Plätze (${courtIds.length})`}</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {!edit && (
            <>
              <button type="button" aria-pressed={all} onClick={() => setCourtIds(all ? [] : courts.map((c) => c.id))} className="chip">
                {all && <Tick />}Alle
              </button>
              {kinds.length > 1 &&
                kinds.map((k) => (
                  <button key={k} type="button" aria-pressed={kindOn(k)} onClick={() => toggleKind(k)} className="chip">
                    {kindOn(k) ? <Tick /> : <Dot color={SURFACE_COLOR[k]} size={9} />}Alle {SURFACE_LABEL[k]}
                  </button>
                ))}
            </>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {courts.map((court) => {
            const on = courtIds.includes(court.id);
            return (
              <button key={court.id} type="button" aria-pressed={on} onClick={() => toggleCourt(court.id)} className="chip">
                {on ? <Tick /> : <Dot color={courtColor(court)} size={9} />}
                {courtLabel(court).name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className={cn("block", edit && "col-span-2")}>
          <span className={label}>{edit ? "Datum" : "Von Datum"}</span>
          <input
            id="blockDate"
            type="date"
            value={dateStr}
            onChange={(e) => {
              setDateStr(e.target.value);
              if (edit || endDateStr < e.target.value) setEndDateStr(e.target.value);
            }}
            className={input}
            required
          />
        </label>
        {!edit && (
          <label className="block">
            <span className={label}>Bis Datum</span>
            <input id="blockEndDate" type="date" value={endDateStr} min={dateStr} onChange={(e) => setEndDateStr(e.target.value)} className={input} required />
          </label>
        )}
        <label className="block">
          <span className={label}>Von Uhrzeit</span>
          <input id="blockStart" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={input} required />
        </label>
        <label className="block">
          <span className={label}>Bis Uhrzeit</span>
          <input id="blockEnd" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={input} required />
        </label>
      </div>

      <label className="block">
        <span className={label}>Grund</span>
        <select id="blockReason" value={reason} onChange={(e) => setReason(e.target.value as BlockReason)} className={input}>
          <option value="MAINTENANCE">Wartung / Platzpflege / Walzen</option>
          <option value="TOURNAMENT">Clubturnier / Interclub-Match</option>
          <option value="RAIN">Regen / Nässe / Witterung</option>
          <option value="TRAINING">Club-Jugendtraining / Camp</option>
          <option value="EVENT">Veranstaltung / Plauschanlass</option>
          <option value="OTHER">Sonstiges</option>
        </select>
      </label>

      <label className="block">
        <span className={label}>Hinweis für Mitglieder</span>
        <input
          id="blockDesc"
          type="text"
          placeholder="z.B. Sandplatz wird gewässert und geebnet"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={input}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 btn btn-pri !h-[50px] w-full active:scale-[.97] disabled:opacity-70"
      >
        {loading && <Spinner />}
        {edit ? "Änderungen speichern" : "Platzsperre aktivieren"}
      </button>
    </form>
  );
}
