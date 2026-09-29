"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { seasonEnd } from "@/lib/membership";
import { getStripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";
import { sendPaymentReminder } from "@/lib/mail";

export async function markInvoiceAsPaidManually(tenantId: string, userId: string, stripeCustomerId: string) {
  try {
    const stripe = getStripe();
    // 1. Admin-Check (Sicherheit) — muss PLATFORM_ADMIN sein, oder CLUB_ADMIN im selben Tenant
    const session = await auth();
    if (!session?.user?.email) {
      throw new Error("Unauthorized");
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenantUsers: true }
    });

    const isAdmin = adminUser?.tenantUsers.some(
      t => t.role === "PLATFORM_ADMIN" || (t.role === "CLUB_ADMIN" && t.tenantId === tenantId)
    );

    if (!isAdmin) {
      throw new Error("Du hast keine Admin-Rechte für diesen Club.");
    }

    // 2. Zielnutzer im selben Tenant verifizieren, inkl. Stripe-Customer-Match
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenantUsers: { where: { tenantId } } }
    });

    if (!targetUser || targetUser.tenantUsers.length === 0) {
      throw new Error("User gehört nicht zu diesem Tenant.");
    }
    if (targetUser.stripeCustomerId !== stripeCustomerId) {
      throw new Error("Stripe Customer stimmt nicht mit dem User überein.");
    }

    // 3. Stripe: Finde die offene Rechnung für diesen Kunden
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      status: "open",
      limit: 1, // Wir nehmen die aktuellste offene Rechnung
    });

    if (invoices.data.length > 0) {
      const openInvoice = invoices.data[0];

      // Sag Stripe: "Wurde außerhalb von Stripe bezahlt (z.B. bar oder manuell überwiesen)"
      // So stoppen wir die automatischen Mahnungen!
      await stripe.invoices.pay(openInvoice.id, {
        paid_out_of_band: true,
      });
      console.log(`✅ Stripe Rechnung ${openInvoice.id} als out-of-band bezahlt markiert.`);
    }

    // 4. Prisma DB Update: Schalte den User sofort frei (nur innerhalb des verifizierten Tenants)
    // the 365 days start when the money is in, not when the invoice was ordered
    await prisma.membership.updateMany({
      where: { userId, tenantId, status: "PENDING" },
      data: { status: "ACTIVE", startsAt: new Date(), endsAt: seasonEnd() }
    });

    // GUEST → MEMBER only; admins and coaches keep their role
    await prisma.tenantUser.updateMany({
      where: { tenantId, userId, role: "GUEST" },
      data: { role: "MEMBER" }
    });

    // 5. UI aktualisieren (Next.js Cache leeren)
    revalidatePath("/admin/users");

    return { success: true, message: "User erfolgreich als bezahlt markiert & freigeschaltet." };

  } catch (error) {
    console.error("Admin Payment Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

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
