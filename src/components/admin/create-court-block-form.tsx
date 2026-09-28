"use client";

import { useState } from "react";
import { Court, BlockReason } from "@/types";
import { createCourtBlockAction } from "@/app/actions/booking";
import { Spinner } from "@/components/app/avatar";

const label = "block truncate text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-clay";

interface CreateCourtBlockFormProps {
  clubSlug: string;
  courts: Court[];
}

export function CreateCourtBlockForm({ clubSlug, courts }: CreateCourtBlockFormProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [courtId, setCourtId] = useState(courts[0]?.id || "");
  const [dateStr, setDateStr] = useState(todayStr);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [reason, setReason] = useState<BlockReason>("MAINTENANCE");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const startsAt = new Date(`${dateStr}T${startTime}:00`).toISOString();
    const endsAt = new Date(`${dateStr}T${endTime}:00`).toISOString();

    const res = await createCourtBlockAction({
      clubSlug,
      courtId,
      startsAt,
      endsAt,
      reason,
      description: description.trim() || undefined,
    });

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: "Platzsperre erfolgreich im Kalender hinterlegt!" });
      setDescription("");
    } else {
      setMessage({ type: "error", text: res.error || "Fehler beim Erstellen der Platzsperre." });
    }
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

      <label className="block">
        <span className={label}>Platz</span>
        <select id="blockCourt" value={courtId} onChange={(e) => setCourtId(e.target.value)} className={input}>
          {courts.map((court) => (
            <option key={court.id} value={court.id}>
              {court.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 block sm:col-span-1">
          <span className={label}>Datum</span>
          <input id="blockDate" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className={input} required />
        </label>
        <label className="block">
          <span className={label}>Von</span>
          <input id="blockStart" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={input} required />
        </label>
        <label className="block">
          <span className={label}>Bis</span>
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
        className="mt-1 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-clay text-[17px] font-bold text-white active:scale-[.97] disabled:opacity-70"
      >
        {loading && <Spinner />}
        Platzsperre aktivieren
      </button>
    </form>
  );
}
