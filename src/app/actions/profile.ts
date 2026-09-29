"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug } from "@/lib/data";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(
  clubSlug: string,
  input: { firstName: string; lastName: string; phone: string }
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Bitte melde dich an." };
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = input.phone.trim();
  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) {
    return { success: false, error: "Bitte gib Vor- und Nachname an." };
  }
  if (phone && !/^\+?[\d\s()/-]{6,20}$/.test(phone)) {
    return { success: false, error: "Ungültige Telefonnummer." };
  }
  await prisma.user.update({ where: { id: session.user.id }, data: { firstName, lastName, phone: phone || null } });
  revalidatePath(`/c/${clubSlug}`, "layout");
  return { success: true };
}

/** Favorite co-players, stored per club membership so they sync across devices. */
export async function setFavoritesAction(clubSlug: string, userIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Bitte melde dich an." };
  const tenant = await getTenantBySlug(clubSlug);
  if (!tenant) return { success: false, error: "Club nicht gefunden." };
  const ids = [...new Set(userIds)].slice(0, 20);
  const r = await prisma.tenantUser.updateMany({
    where: { tenantId: tenant.id, userId: session.user.id },
    data: { favoriteUserIds: ids },
  });
  return r.count ? { success: true } : { success: false, error: "Kein Mitglied dieses Clubs." };
}
