"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/app/sheet";
import { Spinner } from "@/components/app/avatar";
import { SwitchKnob } from "@/components/app/switch";
import { deleteCourtAction, saveCourtAction, type CourtInput } from "@/app/actions/club-settings";
import type { Court } from "@/types";
import { cn } from "@/lib/utils";

const label = "block text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";
const pill = "shrink-0 rounded-full px-3 py-1 text-[13px] font-bold";
const SURFACE: [CourtInput["surface"], string][] = [
  ["CLAY", "Sand"],
  ["HARD", "Hartplatz / Allwetter"],
  ["ARTIFICIAL_GRASS", "Kunstrasen"],
  ["CARPET", "Teppich / Granulat"],
];
const STATUS: [CourtInput["status"], string][] = [
  ["ACTIVE", "Bespielbar"],
  ["MAINTENANCE", "Wartung"],
  ["INACTIVE", "Ausser Betrieb"],
];

const blank = (sortOrder: number): CourtInput => ({
  name: "",
  sportType: "TENNIS",
  surface: "CLAY",
  hourlyRate: 30,
  isIndoor: false,
  hasLighting: false,
  status: "ACTIVE",
  sortOrder,
});

export function CourtsManager({ clubSlug, courts }: { clubSlug: string; courts: Court[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<CourtInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const set = (patch: Partial<CourtInput>) => setEdit((e) => (e ? { ...e, ...patch } : e));

  const open = (c?: Court) => {
    setArmed(false);
    setEdit(
      c
        ? { id: c.id, name: c.name, sportType: c.sportType, surface: c.surface as CourtInput["surface"], hourlyRate: c.hourlyRate, isIndoor: c.isIndoor, hasLighting: c.hasLighting, status: c.status as CourtInput["status"], sortOrder: c.sortOrder }
        : blank(Math.max(0, ...courts.map((x) => x.sortOrder)) + 1)
    );
  };

  async function save() {
    if (!edit || busy) return;
    setBusy(true);
    const res = await saveCourtAction(clubSlug, edit).catch(() => null);
    setBusy(false);
    if (!res?.success) return void toast.error(res?.error ?? "Speichern fehlgeschlagen.");
    toast(edit.id ? "Platz gespeichert" : "Platz angelegt");
    setEdit(null);
    router.refresh();
  }

  async function remove() {
    if (!edit?.id || busy) return;
    if (!armed) return setArmed(true);
    setBusy(true);
    const res = await deleteCourtAction(clubSlug, edit.id).catch(() => null);
    setBusy(false);
    if (!res?.success) return void toast.error(res?.error ?? "Löschen fehlgeschlagen.");
    toast(res.archived ? "Platz hat Buchungen und wurde auf «Ausser Betrieb» gesetzt" : "Platz gelöscht");
    setEdit(null);
    router.refresh();
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-.02em]">Plätze ({courts.length})</h2>
          <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">Antippen zum Bearbeiten.</p>
        </div>
        <button type="button" onClick={() => open()} className="btn btn-pri !h-9 shrink-0">
          + Platz
        </button>
      </div>
      <div className="mt-5 overflow-hidden">
        {courts.map((court) => (
          <button
            key={court.id}
            type="button"
            onClick={() => open(court)}
            className="flex w-full items-center gap-3 border-t border-border px-4 py-3.5 text-left first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold">
                {court.name}
                <span className="ml-2 text-[13px] font-semibold text-muted-foreground">{court.sportType === "PADEL" ? "Padel" : "Tennis"}</span>
              </div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">
                {SURFACE.find(([s]) => s === court.surface)?.[1] ?? court.surface}
                {" · "}
                {court.isIndoor ? "Halle" : "Outdoor"}
                {court.hasLighting && " · Flutlicht"}
                {" · "}
                <span className="font-semibold text-foreground">{court.hourlyRate} CHF/h</span>
              </div>
            </div>
            <span
              className={cn(
                pill,
                court.status === "ACTIVE" ? "bg-paid-bg text-paid-fg" : court.status === "MAINTENANCE" ? "bg-clay text-white" : "bg-inset text-muted-foreground"
              )}
            >
              {STATUS.find(([s]) => s === court.status)?.[1]}
            </span>
          </button>
        ))}
      </div>

      <Sheet open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Platz bearbeiten" : "Neuer Platz"}>
        {edit && (
          <div className="flex flex-col gap-3.5">
            <div className="text-[28px] font-bold tracking-[-.03em]">{edit.id ? "Platz bearbeiten" : "Neuer Platz"}</div>
            <label className="block">
              <span className={label}>Name</span>
              <input value={edit.name} onChange={(e) => set({ name: e.target.value })} placeholder="z.B. Platz 8" className={input} />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className={label}>Sportart</span>
                <select value={edit.sportType} onChange={(e) => set({ sportType: e.target.value as CourtInput["sportType"] })} className={input}>
                  <option value="TENNIS">Tennis</option>
                  <option value="PADEL">Padel</option>
                </select>
              </label>
              <label className="block">
                <span className={label}>Belag</span>
                <select value={edit.surface} onChange={(e) => set({ surface: e.target.value as CourtInput["surface"] })} className={input}>
                  {SURFACE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={label}>CHF pro Stunde</span>
                <input type="number" min={0} step={1} value={edit.hourlyRate} onChange={(e) => set({ hourlyRate: Number(e.target.value) })} className={input} />
              </label>
              <label className="block">
                <span className={label}>Reihenfolge</span>
                <input type="number" min={0} value={edit.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} className={input} />
              </label>
            </div>
            <label className="block">
              <span className={label}>Status</span>
              <select value={edit.status} onChange={(e) => set({ status: e.target.value as CourtInput["status"] })} className={input}>
                {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            {([["isIndoor", "Halle (überdacht)"], ["hasLighting", "Flutlicht"]] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={edit[k]}
                onClick={() => set({ [k]: !edit[k] })}
                className="flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3 text-left"
              >
                <span className="flex-1 text-[16px] font-bold">{l}</span>
                <SwitchKnob on={edit[k]} />
              </button>
            ))}
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="mt-1 btn btn-pri !h-[50px] w-full active:scale-[.97] disabled:opacity-60"
            >
              {busy && <Spinner />}
              {edit.id ? "Speichern" : "Platz anlegen"}
            </button>
            {edit.id && (
              <button type="button" onClick={remove} onBlur={() => setArmed(false)} disabled={busy} className="h-[50px] rounded-[17px] bg-inset text-[16px] font-bold text-clay-text">
                {armed ? "Wirklich löschen?" : "Platz löschen"}
              </button>
            )}
          </div>
        )}
      </Sheet>
    </section>
  );
}
