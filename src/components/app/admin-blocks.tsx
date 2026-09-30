"use client";
import Link from "next/link";
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
import { addDays, atHour, courtColor, courtLabel, hhmm, longDate, SURFACE_COLOR, SURFACE_LABEL, surfaceKind } from "@/lib/courts";
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
  SNOW: "Wintersperre",
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
    const tomorrow = addDays(day, 1).getTime();
    // a winter closure or multi-day block also covers today: turning today off must not delete all of it
    if (on && todays.some((b) => new Date(b.startsAt).getTime() < today || new Date(b.endsAt).getTime() > tomorrow)) {
      return void toast(`${courtLabel(court).name}: Teil einer längeren Sperre, unter „Aktiv und geplant“ bearbeiten`);
    }
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

  const todayRows =
    today === null
      ? []
      : courts.map((c) => {
          const todays = blocks.filter((b) => b.courtId === c.id && overlapsDay(b, today));
          const r = c.id in override ? override[c.id] : (todays[0]?.reason ?? null);
          return { c, todays, r, on: r !== null };
        });
  const kinds = (["clay", "hard", "padel"] as const).filter((k) => courts.some((c) => surfaceKind(c) === k));

  return (
    <>
      <div className="px-5 pt-[66px] @min-[640px]:px-0 @min-[640px]:pt-0">
        <Link href={`/c/${slug}/admin`} className="@min-[640px]:hidden inline-flex items-center gap-1 text-[15px] font-semibold text-clay-text"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Verwaltung</Link>
        <h1 className="text-[28px] font-bold tracking-[-.03em]">Sperren</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">Plätze für Regen, Pflege oder Turnier sperren</div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 px-5 pb-8 pt-4 @min-[640px]:gap-4 @min-[640px]:px-0 @min-[1100px]:grid-cols-2">
        <section className="card p-4 @min-[640px]:p-5">
          <h2 className="text-[18px] font-bold tracking-[-.02em]">Neue Sperre</h2>
          <p className="mt-1 text-[14px] text-ink-3">Auch über mehrere Tage.</p>
          <CreateCourtBlockForm clubSlug={slug} courts={courts} />
        </section>

        <div className="flex flex-col gap-3.5 @min-[640px]:gap-4">
          <section className="card p-4 @min-[640px]:p-5">
            <h2 className="text-[18px] font-bold tracking-[-.02em]">Aktiv und geplant</h2>
            <p className="mt-1 text-[14px] text-ink-3">Nächste 90 Tage</p>
            {today !== null && <Planned slug={slug} courts={courts} blocks={blocks.filter((b) => new Date(b.endsAt).getTime() > now)} now={now} />}
          </section>

          <section className="card p-4 @min-[640px]:p-5">
            <h2 className="text-[18px] font-bold tracking-[-.02em]">Heute ganztägig</h2>
            <Segmented options={REASONS} value={reason} onChange={setReason} label="Grund" className="mt-3" />
            {kinds.length > 1 && todayRows.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {kinds.map((k) => {
                  const rows = todayRows.filter((x) => surfaceKind(x.c) === k);
                  const allOn = rows.every((x) => x.on);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => rows.filter((x) => x.on === allOn).forEach((x) => toggle(x.c, x.todays, x.on))}
                      className="chip"
                    >
                      <Dot color={SURFACE_COLOR[k]} size={9} />
                      {allOn ? `Alle ${SURFACE_LABEL[k]} freigeben` : `Alle ${SURFACE_LABEL[k]} sperren`}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-2 flex flex-col">
              {todayRows.map(({ c, todays, r, on }) => {
                  const label = courtLabel(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(c, todays, on)}
                      className="flex items-center gap-3 border-t border-line py-3 text-left first:border-t-0"
                    >
                      <Dot color={courtColor(c)} size={9} />
                      <div className="flex-1">
                        <div className="text-[15px] font-bold">{label.name}</div>
                        <div className={cn("text-[13px]", on ? "text-bad" : "text-ink-3")}>{on ? `Gesperrt · ${REASON_LABEL[r!]}` : label.sub}</div>
                      </div>
                      <SwitchKnob on={on} />
                    </button>
                  );
                })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Planned({ slug, courts, blocks, now }: { slug: string; courts: Court[]; blocks: CourtBlock[]; now: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const [editing, setEditing] = useState<CourtBlock[] | null>(null);
  const sorted = [...blocks].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const live = picked.filter((id) => sorted.some((b) => b.id === id));
  const allOn = sorted.length > 0 && live.length === sorted.length;
  // same time, reason and note on several courts = one row ("Platz 2–7 · Regen")
  const groups = new Map<string, CourtBlock[]>();
  for (const b of sorted) {
    const k = [b.startsAt, b.endsAt, b.reason, b.description ?? ""].join("|");
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }

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

  if (!sorted.length) return <div className="mt-4 text-[15px] text-ink-3">Keine Sperren geplant.</div>;
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
            className="btn btn-pri !h-9 disabled:opacity-50"
          >
            {armed ? "Wirklich löschen?" : `${live.length} löschen`}
          </button>
        )}
      </div>
      <div className="mt-2">
        {[...groups.values()].map((g) => {
          const b = g[0];
          const court = courts.find((c) => c.id === b.courtId);
          const names = courts.filter((c) => g.some((x) => x.courtId === c.id)).map((c) => courtLabel(c).name);
          const start = new Date(b.startsAt);
          const end = new Date(b.endsAt);
          const ids = g.map((x) => x.id);
          const on = ids.every((id) => live.includes(id));
          // whole days (00:00–00:00) or longer than a day: show the date range, not the clock
          const long = end.getTime() - start.getTime() >= 86_400_000 || (hhmm(start) === "00:00" && hhmm(end) === "00:00");
          const when = long
            ? `${longDate(start)} – ${longDate(new Date(end.getTime() - 1))} · ganztägig`
            : `${longDate(start)} · ${hhmm(start)}–${hhmm(end)}`;
          return (
            <div key={ids.join()} className={cn("flex items-center gap-3 border-t border-line py-3 first:border-t-0", on && "bg-brand-tint")}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => setPicked(on ? live.filter((x) => !ids.includes(x)) : [...new Set([...live, ...ids])])}
                aria-label={`Sperre ${names.join(", ")} ${longDate(start)} auswählen`}
                className="h-5 w-5 shrink-0 accent-clay"
              />
              {court && <Dot color={courtColor(court)} size={9} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 text-[15px] font-bold">
                  <span className="min-w-0 break-words">{(g.length === courts.length ? "Alle Plätze" : names.join(", ")) || "Platz"} · {REASON_LABEL[b.reason]}</span>
                  {start.getTime() <= now && <span className="pill bg-bad-bg text-bad">aktiv</span>}
                </div>
                <div className="text-[13px] text-ink-3">
                  {when}
                  {b.description && ` · ${b.description}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(g)}
                aria-label={`Sperre ${court?.name ?? ""} ${longDate(start)} bearbeiten`}
                className="btn btn-ghost !h-9 shrink-0"
              >
                Bearbeiten
              </button>
            </div>
          );
        })}
      </div>
      <Sheet open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title="Sperre bearbeiten">
        <div className="text-[28px] font-bold tracking-[-.03em]">Sperre bearbeiten</div>
        {editing && <CreateCourtBlockForm key={editing[0].id} clubSlug={slug} courts={courts} edit={editing[0]} group={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}
