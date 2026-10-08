"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/tenant";
import { verifyEventToken } from "@/lib/booking-link";
import { reply } from "@/lib/events-server";

type Res = { success: true } | { success: false; error: string };
const fail = (e: unknown): Res => ({ success: false, error: e instanceof Error ? e.message : String(e) });
const clean = (v: "YES" | "NO", plus: number) => ({ v: v === "YES" ? "YES" as const : "NO" as const, plus: Math.trunc(Number(plus)) || 0 });

/** Öffentliche Seite: der Link-Token ist der Schlüssel, wird hier erneut geprüft. */
export async function replyByToken(inviteId: string, token: string, value: "YES" | "NO", plusOnes: number, comment?: string): Promise<Res> {
  try {
    if (!verifyEventToken(inviteId, token)) throw new Error("Link ungültig.");
    const { v, plus } = clean(value, plusOnes);
    await reply(inviteId, v, plus, comment?.slice(0, 500));
    revalidatePath(`/e/${inviteId}`);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

/** Mitglied in der App: Einladung muss dem eingeloggten User gehören. */
export async function replyMine(slug: string, inviteId: string, value: "YES" | "NO", plusOnes: number): Promise<Res> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) throw new Error("Bitte anmelden.");
    const inv = await prisma.eventInvite.findUnique({ where: { id: inviteId }, select: { userId: true } });
    if (!inv || inv.userId !== user.id) throw new Error("Einladung nicht gefunden.");
    const { v, plus } = clean(value, plusOnes);
    await reply(inviteId, v, plus);
    revalidatePath(`/c/${slug}`);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}
