import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { planFromDb } from "@/lib/data";
import { seasonEnd, parsePartner } from "@/lib/membership";
import type { TenantSettings } from "@/types";

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { planId, paymentMethod, partner: rawPartner, autoRenew } = body;

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // 1. Lade den echten Plan aus der Datenbank
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
      include: { tenant: true }
    });

    if (!plan || plan.status !== "ACTIVE") {
      return NextResponse.json({ error: "Membership Plan not found" }, { status: 404 });
    }
    const rules = planFromDb(plan);
    const settings = plan.tenant.settingsJson as TenantSettings | null;
    if (paymentMethod === "OFFLINE_INVOICE" && !(settings?.payByInvoice && settings.invoiceIban)) {
      return NextResponse.json({ error: "Dieser Club bietet keine Zahlung auf Rechnung an." }, { status: 400 });
    }
    // Paar-Abo: second person comes with the purchase; online only (invoice can't carry the partner)
    const couple = rules.persons === 2;
    const partner = couple ? parsePartner(rawPartner, session.user.email) : null;
    if (typeof partner === "string") return NextResponse.json({ error: partner }, { status: 400 });
    if (couple && paymentMethod === "OFFLINE_INVOICE") {
      return NextResponse.json({ error: "Paar-Abos bitte mit Twint oder Karte bezahlen." }, { status: 400 });
    }

    // 2. Hole oder erstelle den Stripe Customer
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    // age-limited plans (Junioren, Kinder): same Jahrgang rule as the Abo page; a missing birth date is flagged in the admin list instead
    if (user?.birthDate && (rules.ageMin != null || rules.ageMax != null)) {
      const age = new Date().getFullYear() - user.birthDate.getUTCFullYear();
      if (age < (rules.ageMin ?? 0) || age > (rules.ageMax ?? 200)) {
        return NextResponse.json({ error: `Dieses Abo gilt für ${rules.ageMin ?? 0}–${rules.ageMax ?? "∞"} Jahre (Jahrgang).` }, { status: 400 });
      }
    }

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
      // one open invoice per plan: a second click shows the same invoice instead of a second PENDING row
      const open = await prisma.membership.findFirst({
        where: { tenantId: plan.tenantId, userId: user!.id, membershipPlanId: plan.id, status: "PENDING" },
      });
      // with an Abo still running the new season starts when it ends (same as grantMembership)
      const running = await prisma.membership.findFirst({
        where: { tenantId: plan.tenantId, userId: user!.id, status: "ACTIVE", endsAt: { gt: new Date() } },
        orderBy: { endsAt: "desc" },
      });
      const startsAt = running?.endsAt ? new Date(running.endsAt.getTime() + 1000) : new Date();
      const membership =
        open ??
        (await prisma.membership.create({
          data: { tenantId: plan.tenantId, userId: user!.id, membershipPlanId: plan.id, startsAt, endsAt: seasonEnd(startsAt), status: "PENDING" },
        }));

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
        tenantId: plan.tenantId,
        ...(partner && { partnerEmail: partner.email, partnerFirstName: partner.firstName, partnerLastName: partner.lastName }),
        ...(autoRenew === true && { autoRenew: "1" }),
      },
      // auto-renewal keeps the card for an off-session charge before next 31 March (Twint can't, Stripe hides it then)
      ...(autoRenew === true && { payment_intent_data: { setup_future_usage: "off_session" as const } }),
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/c/${plan.tenant.slug}/abos?plan=${plan.id}`,
    });

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
    });
    
  } catch (error) {
    console.error("Checkout Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
