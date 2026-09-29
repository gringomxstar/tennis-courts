"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendPaymentReminder } from "@/lib/mail";

export async function sendPaymentReminderAction(tenantId: string, userId: string) {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Nicht angemeldet." };

  const adminUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantUsers: true },
  });
  const isAdmin = adminUser?.tenantUsers.some(
    (t) => t.role === "PLATFORM_ADMIN" || (t.role === "CLUB_ADMIN" && t.tenantId === tenantId)
  );
  if (!isAdmin) return { success: false, error: "Du hast keine Admin-Rechte für diesen Club." };

  const target = await prisma.tenantUser.findFirst({
    where: { tenantId, userId },
    include: { user: true, tenant: true },
  });
  if (!target) return { success: false, error: "Mitglied gehört nicht zu diesem Club." };

  const sent = await sendPaymentReminder(target.user.email, target.user.firstName, target.tenant.name, target.tenant.slug);
  return sent ? { success: true } : { success: false, error: "Mail konnte nicht versendet werden (Mailversand nicht konfiguriert?)." };
}
