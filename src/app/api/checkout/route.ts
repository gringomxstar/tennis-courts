import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_...", {
  apiVersion: "2026-08-26.dahlia",
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { planId, paymentMethod } = body; 

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // 1. Lade den echten Plan aus der Datenbank
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
      include: { tenant: true }
    });

    if (!plan) {
      return NextResponse.json({ error: "Membership Plan not found" }, { status: 404 });
    }

    // 2. Hole oder erstelle den Stripe Customer
    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: `${user?.firstName} ${user?.lastName}`,
        metadata: { userId: user?.id || "" },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user?.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Self-service join: stellt sicher, dass der User im Ziel-Tenant existiert, bevor ein
    // tenant-scopetes Membership erstellt wird (verhindert inkonsistente (userId, tenantId) Paare).
    await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: plan.tenantId, userId: user!.id } },
      update: {},
      create: { tenantId: plan.tenantId, userId: user!.id, role: "GUEST" },
    });

    // ==========================================
    // MODE A: KAUF AUF RECHNUNG (Offline E-Banking)
    // ==========================================
    if (paymentMethod === "OFFLINE_INVOICE") {
      // Erstelle das Abo im PENDING Status in der Datenbank
      const membership = await prisma.membership.create({
        data: {
          tenantId: plan.tenantId,
          userId: user!.id,
          membershipPlanId: plan.id,
          startsAt: new Date(),
          status: "PENDING"
        }
      });

      return NextResponse.json({
        success: true,
        message: "Offline Rechnung generiert.",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invoice/${membership.id}`,
      });
    }

    // ==========================================
    // MODE B: STRIPE INVOICE (Automated PDF)
    // ==========================================
    if (paymentMethod === "STRIPE_INVOICE") {
      // Wenn wir Inline-Prices nutzen, ist es einfacher, invoice items zu generieren
      // Da Stripe Subscriptions feste Price IDs bevorzugen, nutzen wir hier einen Workaround
      // oder gehen davon aus, dass in einem echten Setup die Stripe Price ID im Plan steht.
      return NextResponse.json({ error: "Stripe Invoice requires pre-created Stripe Prices. Please use OFFLINE_INVOICE or STRIPE." }, { status: 400 });
    }

    // ==========================================
    // MODE C: SOFORTZAHLUNG (Twint, Kreditkarte) mit Inline Pricing
    // ==========================================
    const unitAmount = Math.round(Number(plan.price) * 100); // Stripe erwartet Rappen/Cents

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment", // Da wir Inline-Prices nutzen, nutzen wir 'payment' (Einmalzahlung). Für Recurring ('subscription') braucht Stripe feste Price IDs in ihrem Dashboard.
      line_items: [
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: {
              name: plan.name,
              description: `Abo für ${plan.tenant.name}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        }
      ],
      // Damit der Webhook später weiß, welches Abo freigeschaltet werden muss:
      metadata: {
        userId: user!.id,
        planId: plan.id,
        tenantId: plan.tenantId
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/membership`,
    });

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
    });
    
  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
