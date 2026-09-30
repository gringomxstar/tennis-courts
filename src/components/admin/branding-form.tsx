"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateClubBrandingAction } from "@/app/actions/club-settings";
import { Spinner } from "@/components/app/avatar";
import { cn } from "@/lib/utils";
import { BOOKING_COLORS, BOOKING_ROLE_LABEL } from "@/lib/courts";
import type { LimitRole, TenantSettings } from "@/types";

const DEFAULT = "#e25b36";
const PRESETS: [string, string][] = [
  [DEFAULT, "Sand"],
  ["#2563eb", "Blau"],
  ["#1e3a8a", "Marine"],
  ["#15803d", "Grün"],
  ["#dc2626", "Rot"],
  ["#7c3aed", "Violett"],
  ["#0f766e", "Petrol"],
  ["#111827", "Schwarz"],
];

/** Shrinks the picked image to max 256px so it fits in the tenant row as a data URL. */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 256 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const preview = (hex: string) => document.documentElement.style.setProperty("--tennis-clay", hex);

export function BrandingForm({ clubSlug, clubName: initialName, color: initialColor, logo: initialLogo, bookingColors }: {
  clubSlug: string;
  clubName: string;
  color?: string;
  logo?: string | null;
  bookingColors?: TenantSettings["bookingColors"];
}) {
  const router = useRouter();
  const [clubName, setClubName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? DEFAULT);
  const [logo, setLogo] = useState<string | null | undefined>(undefined); // undefined = unchanged
  const [roleColors, setRoleColors] = useState({ ...BOOKING_COLORS, ...bookingColors });
  const [busy, setBusy] = useState(false);
  const shownLogo = logo === undefined ? initialLogo : logo;
  // drop the unsaved live preview when leaving the page
  useEffect(() => () => void document.documentElement.style.removeProperty("--tennis-clay"), []);

  const pick = (hex: string) => {
    setColor(hex);
    preview(hex);
  };

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return void toast("Bitte ein PNG, JPG, WebP oder SVG wählen.");
    const url = await toDataUrl(file).catch(() => null);
    if (!url) return void toast("Das Bild konnte nicht gelesen werden.");
    setLogo(url);
  }

  async function save() {
    setBusy(true);
    const res = await updateClubBrandingAction(clubSlug, color.toLowerCase() === DEFAULT ? null : color, logo, roleColors, clubName).catch(() => null);
    setBusy(false);
    if (!res?.success) return void toast.error(res?.error ?? "Speichern fehlgeschlagen.");
    toast("Branding gespeichert");
    setLogo(undefined);
    router.refresh();
  }

  return (
    <section className="card p-5">
      <h2 className="text-[22px] font-bold tracking-[-.02em]">Clubname, Farbe & Logo</h2>
      <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">Die Farbe gilt für Buttons, freie Slots und Markierungen in der ganzen App. Name, Logo und Farbe erscheinen auch als Tab-Titel, Favicon und App-Symbol auf dem Home-Bildschirm.</p>

      <div className="mt-4 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">Clubname</div>
      <input value={clubName} onChange={(e) => setClubName(e.target.value)} maxLength={60} aria-label="Clubname" className="mt-2.5 h-12 w-full rounded-[14px] border border-border bg-transparent px-4 text-[16px] font-semibold" />

      <div className="mt-4 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">Farbe</div>
      <div className="mt-2.5 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Clubfarbe">
        {PRESETS.map(([hex, name]) => {
          const on = color.toLowerCase() === hex;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={name}
              title={name}
              onClick={() => pick(hex)}
              className={cn("h-11 w-11 rounded-full transition-transform duration-300 ease-spring", on && "scale-110")}
              style={{ background: hex, boxShadow: on ? `0 0 0 3px var(--card), 0 0 0 5px ${hex}` : "none" }}
            />
          );
        })}
        <label className="relative flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-3.5 text-[14px] font-semibold">
          <span className="h-5 w-5 rounded-full border border-border" style={{ background: color }} />
          Eigene
          <input type="color" value={color} onChange={(e) => pick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Eigene Farbe" />
        </label>
      </div>

      <div className="mt-5 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">Buchungen im Kalender</div>
      <p className="mt-1 text-[14px] leading-[1.4] text-muted-foreground">Farbe der Buchungen anderer Spieler. Eigene Buchungen erscheinen in der Clubfarbe.</p>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        {(Object.keys(BOOKING_COLORS) as LimitRole[]).map((r) => (
          <label key={r} className="relative flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-3.5 text-[14px] font-semibold">
            <span className="h-5 w-5 rounded-full" style={{ background: roleColors[r] }} />
            {BOOKING_ROLE_LABEL[r]}
            <input
              type="color"
              value={roleColors[r]}
              onChange={(e) => setRoleColors((c) => ({ ...c, [r]: e.target.value }))}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={`Farbe ${BOOKING_ROLE_LABEL[r]}`}
            />
          </label>
        ))}
        <button type="button" onClick={() => setRoleColors({ ...BOOKING_COLORS })} className="px-2 text-[14px] font-bold text-clay-text">
          Standard
        </button>
      </div>

      <div className="mt-5 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">Logo</div>
      <div className="mt-2.5 flex items-center gap-3.5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-inset text-[20px] font-bold text-clay-text">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          {shownLogo ? <img src={shownLogo} alt="" className="h-full w-full object-contain" /> : clubName.slice(0, 2).toUpperCase()}
        </span>
        <label className="cursor-pointer rounded-full bg-inset px-4 py-2.5 text-[14px] font-bold">
          {shownLogo ? "Ersetzen" : "Hochladen"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={pickLogo} className="sr-only" />
        </label>
        {shownLogo && (
          <button type="button" onClick={() => setLogo(null)} className="text-[14px] font-bold text-clay-text">
            Entfernen
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-5 btn btn-pri !h-[50px] w-full active:scale-[.97] disabled:opacity-60"
      >
        {busy && <Spinner />}
        Speichern
      </button>
    </section>
  );
}
