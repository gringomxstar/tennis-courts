"use client";

import { useState } from "react";
import { Court, BlockReason } from "@/types";
import { createCourtBlockAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div>
        <Label htmlFor="blockCourt">Platz auswählen</Label>
        <select
          id="blockCourt"
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {courts.map((court) => (
            <option key={court.id} value={court.id}>
              {court.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="blockDate">Datum</Label>
          <Input
            id="blockDate"
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="mt-1.5"
            required
          />
        </div>
        <div>
          <Label htmlFor="blockStart">Von</Label>
          <Input
            id="blockStart"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1.5"
            required
          />
        </div>
        <div>
          <Label htmlFor="blockEnd">Bis</Label>
          <Input
            id="blockEnd"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1.5"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="blockReason">Grund der Sperre</Label>
        <select
          id="blockReason"
          value={reason}
          onChange={(e) => setReason(e.target.value as BlockReason)}
          className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="MAINTENANCE">Wartung / Platzpflege / Walzen</option>
          <option value="TOURNAMENT">Clubturnier / Interclub-Match</option>
          <option value="RAIN">Regen / Nässe / Witterung</option>
          <option value="TRAINING">Club-Jugendtraining / Camp</option>
          <option value="EVENT">Veranstaltung / Plauschanlass</option>
          <option value="OTHER">Sonstiges</option>
        </select>
      </div>

      <div>
        <Label htmlFor="blockDesc">Beschreibung / Hinweis für Mitglieder</Label>
        <Input
          id="blockDesc"
          type="text"
          placeholder="z.B. Sandplatz wird gewässert und geebnet"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1.5"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
        Platzsperre aktivieren
      </Button>
    </form>
  );
}
