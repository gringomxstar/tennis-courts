"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dot } from "@/components/app/avatar";
import { Segmented } from "@/components/app/segmented";
import { SwitchKnob } from "@/components/app/switch";
import { overlapsDay, useToday } from "@/components/app/admin-today";
import { createCourtBlockAction, deleteCourtBlockAction } from "@/app/actions/booking";
import { atHour, courtColor, courtLabel } from "@/lib/courts";
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
  const { today } = useToday();
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
              courtId: court.id,
              startsAt: atHour(day, settings?.openingHour ?? 7).toISOString(),
              endsAt: atHour(day, settings?.closingHour ?? 22).toISOString(),
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
    </>
  );
}
