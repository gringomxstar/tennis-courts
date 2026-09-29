"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { stopAutoRenew } from "@/lib/abo-renewal";

/** Abo page: switch automatic renewal off (it is switched on by paying with the checkbox). */
export async function stopAutoRenewAction(slug: string) {
  const { tenant, user } = await getTenantContext(slug);
  if (!user) return { error: "Bitte melde dich an." };
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
  if (!u?.stripeCustomerId) return { error: "Keine automatische Verlängerung aktiv." };
  await stopAutoRenew(u.stripeCustomerId, tenant.id);
  revalidatePath(`/c/${slug}/abos`);
  return { ok: true };
}
