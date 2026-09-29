"use client";

import { useRouter } from "next/navigation";
import { LabeledSwitch } from "@/components/app/switch";

/** Spieler/Admin: jumps between the player app and club admin. */
export function ModeSwitch({ slug, admin }: { slug: string; admin: boolean }) {
  const router = useRouter();
  return <LabeledSwitch left="Spieler" right="Admin" label="Admin-Modus" on={admin} onChange={(on) => router.push(on ? `/c/${slug}/admin` : `/c/${slug}`)} />;
}
