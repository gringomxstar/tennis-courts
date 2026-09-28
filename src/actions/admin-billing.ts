"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";

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
    await prisma.membership.updateMany({
      where: { userId, tenantId, status: { in: ["PENDING", "EXPIRED"] } },
      data: { status: "ACTIVE" }
    });

    await prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId, userId } },
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
