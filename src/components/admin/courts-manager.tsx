"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/app/sheet";
import { Spinner } from "@/components/app/avatar";
import { SwitchKnob } from "@/components/app/switch";
import { Segmented } from "@/components/app/segmented";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteCourtAction, saveCourtAction, type CourtInput } from "@/app/actions/club-settings";
import type { Court } from "@/types";
import { cn } from "@/lib/utils";

const label = "block text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const input =
  "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";
const pill = "shrink-0 rounded-full px-3 py-1 text-[13px] font-bold";
const SURFACE: readonly (readonly [CourtInput["surface"], string])[] = [
  ["CLAY", "Sand"],
  ["HARD", "Hartplatz / Allwetter"],
  ["ARTIFICIAL_GRASS", "Kunstrasen"],
  ["CARPET", "Teppich / Granulat"],
];
const STATUS: readonly (readonly [CourtInput["status"], string])[] = [
  ["ACTIVE", "Bespielbar"],
  ["MAINTENANCE", "Wartung"],
  ["INACTIVE", "Ausser Betrieb"],
];

const STATUS_HELP: Record<CourtInput["status"], string> = {
  ACTIVE: "Mitglieder können den Platz buchen.",
  MAINTENANCE: "Vorübergehend weg aus dem Kalender. Für einzelne Tage besser eine Sperre planen.",
  INACTIVE: "Dauerhaft weg aus dem Kalender, z. B. abgebaut.",
};

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
  const set = (patch: Partial<CourtInput>) => setEdit((e) => (e ? { ...e, ...patch } : e));

  const toInput = (c: Court): CourtInput => ({ id: c.id, name: c.name, sportType: c.sportType, surface: c.surface as CourtInput["surface"], hourlyRate: c.hourlyRate, isIndoor: c.isIndoor, hasLighting: c.hasLighting, status: c.status as CourtInput["status"], sortOrder: c.sortOrder });
  const open = (c?: Court) => setEdit(c ? toInput(c) : blank(Math.max(0, ...courts.map((x) => x.sortOrder)) + 1));

  async function setStatus(c: Court, status: CourtInput["status"]) {
    if (busy || c.status === status) return;
    setBusy(true);
    const res = await saveCourtAction(clubSlug, { ...toInput(c), status }).catch(() => null);
    setBusy(false);
    if (!res?.success) return void toast.error(res?.error ?? "Speichern fehlgeschlagen.");
    toast(`${c.name}: ${STATUS.find(([v]) => v === status)?.[1]}`);
    router.refresh();
  }

  /** Platz eine Position nach oben/unten: Reihenfolge neu durchnummerieren und geänderte speichern. */
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (busy || j < 0 || j >= courts.length) return;
    const order = [...courts];
    [order[i], order[j]] = [order[j], order[i]];
    setBusy(true);
    const results = await Promise.all(
      order.map((c, k) => (c.sortOrder === k + 1 ? null : saveCourtAction(clubSlug, { ...toInput(c), sortOrder: k + 1 }).catch(() => null))).filter(Boolean)
    );
    setBusy(false);
    if (results.some((r) => !r?.success)) toast.error("Reihenfolge konnte nicht gespeichert werden.");
    router.refresh();
  }

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
          <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">Antippen zum Bearbeiten, Pfeile für die Reihenfolge im Kalender.</p>
        </div>
        <button type="button" onClick={() => open()} className="btn btn-pri shrink-0">
          + Platz
        </button>
      </div>
      <div className="mt-5 overflow-hidden">
        {courts.map((court, i) => (
          <div key={court.id} className="flex items-center gap-1 border-t border-border first:border-t-0">
          <button
            type="button"
            onClick={() => open(court)}
            className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-2 text-left"
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
                court.status !== "INACTIVE" && "@min-[1024px]:hidden",
                court.status === "ACTIVE" ? "bg-paid-bg text-paid-fg" : court.status === "MAINTENANCE" ? "bg-clay text-white" : "bg-inset text-muted-foreground"
              )}
            >
              {STATUS.find(([s]) => s === court.status)?.[1]}
            </span>
          </button>
          {court.status !== "INACTIVE" && (
            <Segmented
              className="hidden w-[220px] shrink-0 @min-[1024px]:flex"
              label={`Zustand ${court.name}`}
              options={STATUS.slice(0, 2)}
              value={court.status as CourtInput["status"]}
              onChange={(v) => setStatus(court, v)}
            />
          )}
          {([[-1, "↑", "nach oben"], [1, "↓", "nach unten"]] as const).map(([dir, icon, l]) => (
            <button key={dir} type="button" aria-label={`${court.name} ${l}`} disabled={busy || i + dir < 0 || i + dir >= courts.length} onClick={() => move(i, dir)} className="grid h-10 w-9 shrink-0 place-items-center rounded-full text-[13px] text-muted-foreground disabled:opacity-25">
              {icon}
            </button>
          ))}
          </div>
        ))}
      </div>

      <Sheet open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? edit.name || "Platz bearbeiten" : "Neuer Platz"}>
        {edit && (
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className={label}>Name <span className="text-bad">*</span></span>
              <input value={edit.name} onChange={(e) => set({ name: e.target.value })} placeholder="z.B. Platz 8" required className={input} />
            </label>
            <div>
              <span className={label}>Sportart</span>
              <Segmented className="mt-1.5" label="Sportart" options={[["TENNIS", "Tennis"], ["PADEL", "Padel"]] as const} value={edit.sportType} onChange={(v) => set({ sportType: v })} />
            </div>
            <div>
              <span className={label}>Belag</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SURFACE.map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={edit.surface === v} onClick={() => set({ surface: v })} className="chip">
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className={label}>Preis pro Stunde</span>
              <span className="flex items-center gap-2.5">
                <input type="number" min={0} step={1} inputMode="decimal" value={Number.isNaN(edit.hourlyRate) ? "" : edit.hourlyRate} onChange={(e) => set({ hourlyRate: e.target.value === "" ? NaN : Number(e.target.value) })} className={`${input} max-w-[120px]`} />
                <span className="mt-1.5 text-[15px] text-muted-foreground">CHF</span>
              </span>
              <span className="mt-1.5 block text-[13px] text-muted-foreground">Grundpreis für diesen Platz. Preisregeln (z. B. Rabatt am Vormittag) werden darauf angewendet.</span>
            </label>
            <div>
              <span className={label}>Zustand</span>
              <Segmented className="mt-1.5" label="Zustand" options={STATUS} value={edit.status} onChange={(v) => set({ status: v })} />
              <span className="mt-1.5 block text-[13px] text-muted-foreground">{STATUS_HELP[edit.status]}</span>
            </div>
            {([["isIndoor", "Halle", "Überdacht, auch bei Regen bespielbar"], ["hasLighting", "Flutlicht", "Abends buchbar"]] as const).map(([k, l, sub]) => (
              <button
                key={k}
                type="button"
                aria-pressed={edit[k]}
                onClick={() => set({ [k]: !edit[k] })}
                className="flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3 text-left"
              >
                <span className="flex-1">
                  <b className="block text-[16px]">{l}</b>
                  <small className="block text-[13px] text-muted-foreground">{sub}</small>
                </span>
                <SwitchKnob on={edit[k]} />
              </button>
            ))}
            <div className="sticky bottom-0 -mx-1 bg-card px-1 pb-1 pt-2">
              <button
                type="button"
                onClick={save}
                disabled={busy || !edit.name.trim() || Number.isNaN(edit.hourlyRate)}
                className="btn btn-pri !h-[50px] w-full active:scale-[.97] disabled:opacity-60"
              >
                {busy && <Spinner />}
                {edit.id ? "Speichern" : "Platz anlegen"}
              </button>
            </div>
            {edit.id && (
              <div>
                <ConfirmButton onConfirm={remove} confirm="Wirklich entfernen?" disabled={busy} className="h-[50px] w-full rounded-[17px] bg-inset text-[16px] font-bold text-clay-text">
                  Platz entfernen
                </ConfirmButton>
                <p className="mt-1.5 text-[13px] text-muted-foreground">Hat der Platz schon Buchungen, wird er nur auf «Ausser Betrieb» gesetzt. Die Buchungen bleiben bestehen.</p>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </section>
  );
}
