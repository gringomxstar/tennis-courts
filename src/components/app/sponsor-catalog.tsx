"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { chf, itemHint } from "@/lib/sponsoring";
import { Sheet } from "@/components/app/sheet";
import { field, fieldLabel, pill } from "@/components/app/admin-sponsoring";
import { deleteItemAction, saveItemAction } from "@/app/actions/sponsoring";

type Item = {
  id: string; name: string; description: string; price: number; capacity: number | null; badge: string; deliverables: string[];
  hasImage: boolean; sortOrder: number; active: boolean; taken: number; sponsors: { id: string; name: string; quantity: number }[];
};

export function SponsorCatalog({ slug, year, items }: { slug: string; year: number; items: Item[] }) {
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  return (
    <section className="px-5 pb-10 pt-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setEdit("new")} className={cn(pill, "bg-brand-deep text-white")}>+ Leistung</button>
      </div>
      <ul className="mt-3 grid gap-3 @min-[900px]:grid-cols-2">
        {items.map((it) => {
          const hint = itemHint(it.capacity, it.taken, it.badge);
          return (
            <li key={it.id} className={cn("card flex gap-4 p-4", !it.active && "opacity-60")}>
              {it.hasImage ? <img src={`/sponsor/bild/${it.id}`} alt="" className="h-20 w-20 flex-none rounded-[14px] object-cover" /> : <div aria-hidden className="h-20 w-20 flex-none rounded-[14px] bg-brand-tint" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[16px]">{it.name}</b>
                  {!it.active && <span className="rounded-full bg-bg px-2 py-0.5 text-[12px] font-bold text-ink-2">ausgeblendet</span>}
                  {hint && <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", hint.tone === "sold" ? "bg-bad-bg text-bad" : hint.tone === "low" ? "bg-warn-bg text-warn" : "bg-brand-tint text-brand-deep")}>{hint.text}</span>}
                </div>
                <div className="text-[14px] tabular-nums">{chf(it.price)} / Jahr</div>
                <div className="mt-1 text-[13.5px] text-ink-2">
                  {it.capacity == null ? `${it.taken} vergeben ${year}, unbegrenzt` : `${it.taken} von ${it.capacity} vergeben ${year} · ${Math.max(0, it.capacity - it.taken)} frei`}
                </div>
                {it.sponsors.length > 0 && (
                  <div className="mt-1 text-[13px] text-ink-3">
                    {it.sponsors.map((s, i) => <span key={s.id + i}>{i ? ", " : ""}<Link href={`/c/${slug}/admin/sponsoring/${s.id}`} className="underline-offset-2 hover:underline">{s.name}{s.quantity > 1 ? ` (${s.quantity})` : ""}</Link></span>)}
                  </div>
                )}
                <button type="button" onClick={() => setEdit(it)} className="mt-2 text-[13.5px] font-semibold text-brand-deep">Bearbeiten</button>
              </div>
            </li>
          );
        })}
        {!items.length && <li className="card p-6 text-center text-[14px] text-ink-3">Noch keine Leistungen. Erfassen Sie z.B. Blache, Tischset, Hauptsponsor, Container (1 Platz), Centre Court (1 Platz).</li>}
      </ul>
      <ItemSheet key={edit === "new" ? "new" : edit?.id ?? "none"} slug={slug} item={edit} onClose={() => setEdit(null)} />
    </section>
  );
}

function ItemSheet({ slug, item, onClose }: { slug: string; item: Item | "new" | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const it = item && item !== "new" ? item : null;
  return (
    <Sheet open={item != null} onOpenChange={(o) => !o && onClose()} title={it ? "Leistung bearbeiten" : "Neue Leistung"}>
      <form className="grid gap-3" action={(fd) => start(async () => {
        if (it) fd.set("id", it.id);
        const r = await saveItemAction(slug, fd);
        if (!r.success) return void toast.error(r.error);
        toast.success("Gespeichert");
        onClose();
        router.refresh();
      })}>
        <label className={fieldLabel}>Name<input name="name" required defaultValue={it?.name} placeholder="z.B. Blache am Platz 1" className={field} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={fieldLabel}>Preis CHF / Jahr<input name="price" required inputMode="decimal" defaultValue={it?.price} className={field} /></label>
          <label className={fieldLabel}>Plätze<input name="capacity" type="number" min={1} defaultValue={it?.capacity ?? ""} placeholder="unbegrenzt" className={field} /></label>
        </div>
        <p className="-mt-1 text-[12.5px] text-ink-3">1 Platz = exklusiv (Container, Centre Court). Leer = unbegrenzt.</p>
        <label className={fieldLabel}>Hinweis im Portal<input name="badge" defaultValue={it?.badge} placeholder="z.B. Bestseller" maxLength={30} className={field} /></label>
        <label className={fieldLabel}>Beschreibung<textarea name="description" defaultValue={it?.description} rows={2} maxLength={500} className={cn(field, "h-auto py-3")} /></label>
        <label className={fieldLabel}>Gegenleistungen (eine pro Zeile)
          <textarea name="deliverables" defaultValue={it?.deliverables.join("\n")} rows={3} placeholder={"Blache aufhängen\nLogo auf Website\nEinladung Sponsoren-Apéro"} className={cn(field, "h-auto py-3")} />
        </label>
        <label className={fieldLabel}>Foto<input name="image" type="file" accept="image/png,image/jpeg,image/webp" className={cn(field, "pt-3")} /></label>
        {it?.hasImage && <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="removeImage" value="true" />Foto entfernen</label>}
        <div className="grid grid-cols-2 gap-3">
          <label className={fieldLabel}>Reihenfolge<input name="sortOrder" type="number" defaultValue={it?.sortOrder ?? 0} className={field} /></label>
          <label className={fieldLabel}>Im Portal
            <select name="active" defaultValue={String(it?.active ?? true)} className={field}><option value="true">sichtbar</option><option value="false">ausgeblendet</option></select>
          </label>
        </div>
        <button disabled={pending} className="btn btn-pri h-[52px] w-full">{pending ? "…" : "Speichern"}</button>
        {it && (
          <button type="button" disabled={pending} onClick={() => window.confirm(`«${it.name}» löschen?`) && start(async () => {
            const r = await deleteItemAction(slug, it.id);
            if (!r.success) return void toast.error(r.error);
            toast.success(r.hidden ? "Ist in Verträgen, darum nur ausgeblendet" : "Gelöscht");
            onClose();
            router.refresh();
          })} className="text-[14px] font-semibold text-bad">Löschen</button>
        )}
      </form>
    </Sheet>
  );
}
