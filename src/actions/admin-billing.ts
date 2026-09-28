"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { revalidatePath } from "next/cache";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_fallback_so_build_does_not_crash", {
  apiVersion: "2026-08-26.dahlia",
});

export async function markInvoiceAsPaidManually(userId: string, stripeCustomerId: string) {
  try {
    // 1. Admin-Check (Sicherheit)
    const session = await auth();
    if (!session?.user?.email) {
      throw new Error("Unauthorized");
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenantUsers: true }
    });

    const isAdmin = adminUser?.tenantUsers.some(
      t => t.role === "PLATFORM_ADMIN" || t.role === "CLUB_ADMIN"
    );

    if (!isAdmin) {
      throw new Error("Du hast keine Admin-Rechte für diese Aktion.");
    }

    // 2. Stripe: Finde die offene Rechnung für diesen Kunden
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

    // 3. Prisma DB Update: Schalte den User sofort frei
    await prisma.membership.updateMany({
      where: { userId: userId, status: { in: ["PENDING", "EXPIRED"] } },
      data: { status: "ACTIVE" }
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenantUsers: true }
    });

    if (targetUser && targetUser.tenantUsers.length > 0) {
      await prisma.tenantUser.update({
        where: { id: targetUser.tenantUsers[0].id },
        data: { role: "MEMBER" }
      });
    }

    // 4. UI aktualisieren (Next.js Cache leeren)
    revalidatePath("/admin/users");
    
    return { success: true, message: "User erfolgreich als bezahlt markiert & freigeschaltet." };

  } catch (error: any) {
    console.error("Admin Payment Error:", error);
    return { success: false, error: error.message };
  }
}
