"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dot } from "@/components/app/avatar";
import { Segmented } from "@/components/app/segmented";
import { Sheet } from "@/components/app/sheet";
import { SwitchKnob } from "@/components/app/switch";
import { overlapsDay, useToday } from "@/components/app/admin-today";
import { createCourtBlockAction, deleteCourtBlockAction } from "@/app/actions/booking";
import { CreateCourtBlockForm } from "@/components/admin/create-court-block-form";
import { atHour, courtColor, courtLabel, hhmm, longDate } from "@/lib/courts";
import type { BlockReason, Court, CourtBlock, TenantSettings } from "@/types";
import { cn } from "@/lib/utils";

const REASONS = [
  ["RAIN", "Regen"],
  ["MAINTENANCE", "Wartung"],
  ["TOURNAMENT", "Turnier"],
] as const;

const REASON_LABEL: Record<BlockReason, string> = {
  RAIN: "Regen",
  MAINTENANCE: "Wartung",
  TOURNAMENT: "Turnier",
  SNOW: "Schnee",
  TRAINING: "Training",
  EVENT: "Event",
  PRIVATE: "Privat",
  OTHER: "Sonstiges",
};

export function AdminBlocks({
  slug,
  settings,
  courts,
  blocks,
}: {
  slug: string;
  settings: TenantSettings | null | undefined;
  courts: Court[];
  blocks: CourtBlock[];
}) {
  const router = useRouter();
  const { now, today } = useToday();
  const [reason, setReason] = useState<BlockReason>("RAIN");
  const [, startTransition] = useTransition();
  // courtId -> reason (on) / null (off), until the refreshed server data takes over
  const [override, setOverride] = useOptimistic<Record<string, BlockReason | null>, [string, BlockReason | null]>(
    {},
    (s, [id, r]) => ({ ...s, [id]: r })
  );

  function toggle(court: Court, todays: CourtBlock[], on: boolean) {
    if (today === null) return;
    const day = new Date(today);
    startTransition(async () => {
      setOverride([court.id, on ? null : reason]);
      const results = on
        ? await Promise.all(todays.map((b) => deleteCourtBlockAction({ clubSlug: slug, blockId: b.id })))
        : [
            await createCourtBlockAction({
              clubSlug: slug,
              items: [
                {
                  courtId: court.id,
                  startsAt: atHour(day, settings?.openingHour ?? 7).toISOString(),
                  endsAt: atHour(day, settings?.closingHour ?? 22).toISOString(),
                },
              ],
              reason,
            }),
          ];
      const failed = results.find((r) => !r.success);
      if (failed) toast(failed.error ?? "Sperre fehlgeschlagen");
      router.refresh();
    });
  }

  return (
    <>
      <div className="px-5 pt-[66px] lg:pt-12">
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Plätze sperren</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">Gilt für heute, ganztägig</div>
      </div>
      <Segmented options={REASONS} value={reason} onChange={setReason} label="Grund" className="mx-5 mt-4 lg:max-w-[480px]" />
      <div className="flex flex-col gap-2.5 px-5 pt-3.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
        {today !== null &&
          courts.map((c) => {
            const todays = blocks.filter((b) => b.courtId === c.id && overlapsDay(b, today));
            const r = c.id in override ? override[c.id] : (todays[0]?.reason ?? null);
            const on = r !== null;
            const label = courtLabel(c);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c, todays, on)}
                className="flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5 text-left"
              >
                <Dot color={courtColor(c)} size={9} />
                <div className="flex-1">
                  <div className="text-[16px] font-bold">{label.name}</div>
                  <div className={cn("text-[14px]", on ? "text-clay-text" : "text-muted-foreground")}>
                    {on ? `Gesperrt · ${REASON_LABEL[r]}` : label.sub}
                  </div>
                </div>
                <SwitchKnob on={on} />
              </button>
            );
          })}
      </div>

      <div className="grid grid-cols-1 gap-4 px-5 pb-8 pt-8 lg:grid-cols-2 lg:items-start lg:gap-6">
        <section className="rounded-[26px] border border-border bg-card p-5">
          <h2 className="text-[22px] font-bold tracking-[-.02em]">Sperre planen</h2>
          <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">Turnier, Platzpflege oder Training, auch über mehrere Tage.</p>
          <CreateCourtBlockForm clubSlug={slug} courts={courts} />
        </section>

        <section className="rounded-[26px] border border-border bg-card p-5">
          <h2 className="text-[22px] font-bold tracking-[-.02em]">Geplante Sperren</h2>
          <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">Nächste 90 Tage</p>
          {today !== null && <Planned slug={slug} courts={courts} blocks={blocks.filter((b) => new Date(b.endsAt).getTime() > now)} />}
        </section>
      </div>
    </>
  );
}

function Planned({ slug, courts, blocks }: { slug: string; courts: Court[]; blocks: CourtBlock[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const [editing, setEditing] = useState<CourtBlock | null>(null);
  const sorted = [...blocks].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const live = picked.filter((id) => sorted.some((b) => b.id === id));
  const allOn = sorted.length > 0 && live.length === sorted.length;

  async function removePicked() {
    if (!live.length || busy) return;
    if (!armed) return setArmed(true);
    setBusy(true);
    const results = await Promise.all(live.map((id) => deleteCourtBlockAction({ clubSlug: slug, blockId: id }).catch(() => null)));
    setBusy(false);
    setArmed(false);
    const failed = results.filter((r) => !r?.success).length;
    toast(failed ? `${failed} Sperren konnten nicht gelöscht werden` : `${live.length} ${live.length === 1 ? "Sperre" : "Sperren"} gelöscht`);
    setPicked([]);
    router.refresh();
  }

  if (!sorted.length) return <div className="mt-5 text-[15px] text-muted-foreground">Keine Sperren geplant.</div>;
  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? [] : sorted.map((b) => b.id))} className="h-5 w-5 accent-clay" />
          Alle auswählen
        </label>
        {live.length > 0 && (
          <button
            type="button"
            onClick={removePicked}
            onBlur={() => setArmed(false)}
            disabled={busy}
            className="rounded-full bg-clay px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {armed ? "Wirklich löschen?" : `${live.length} löschen`}
          </button>
        )}
      </div>
      <div className="mt-3 overflow-hidden rounded-[22px] border border-border">
        {sorted.map((b) => {
          const court = courts.find((c) => c.id === b.courtId);
          const start = new Date(b.startsAt);
          const on = live.includes(b.id);
          return (
            <div key={b.id} className={cn("flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0", on && "bg-free-tint")}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => setPicked(on ? live.filter((x) => x !== b.id) : [...live, b.id])}
                aria-label={`Sperre ${court?.name ?? ""} ${longDate(start)} auswählen`}
                className="h-5 w-5 shrink-0 accent-clay"
              />
              {court && <Dot color={courtColor(court)} size={9} />}
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">
                  {court?.name ?? "Platz"} · {REASON_LABEL[b.reason]}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {longDate(start)} · {hhmm(start)}–{hhmm(new Date(b.endsAt))}
                  {b.description && ` · ${b.description}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(b)}
                aria-label={`Sperre ${court?.name ?? ""} ${longDate(start)} bearbeiten`}
                className="shrink-0 rounded-full bg-inset px-3 py-1.5 text-[13px] font-bold"
              >
                Bearbeiten
              </button>
            </div>
          );
        })}
      </div>
      <Sheet open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title="Sperre bearbeiten">
        <div className="text-[28px] font-bold tracking-[-.03em]">Sperre bearbeiten</div>
        {editing && <CreateCourtBlockForm key={editing.id} clubSlug={slug} courts={courts} edit={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}
