import { CheckCircle2, Check } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CheckoutButton } from "@/components/ui/checkout-button";

export default async function MembershipPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  // Für das MVP nehmen wir den ersten aktiven Club (Tenant) als Fallback. 
  // Später wird dies via Subdomain (z.B. marly.tennisapp.ch) aufgelöst.
  const tenant = await prisma.tenant.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0A0A0A]">
        <p className="text-slate-500">Systemfehler: Kein aktiver Club gefunden.</p>
      </div>
    );
  }

  // Lade alle aktiven Abo-Pläne dieses Clubs
  const plans = await prisma.membershipPlan.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE" },
    orderBy: { price: 'asc' }
  });

  return (
    <div className="min-h-screen bg-background text-foreground py-24 selection:bg-clay/30">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-clay font-semibold tracking-wide uppercase text-sm mb-3">
            Mitgliedschaften bei {tenant.name}
          </h2>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
            Dein Zugang zum Court. <br className="hidden md:block" />
            Ohne Kompromisse.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Wähle das Abo, das zu deinem Spiel passt. Zahlung sicher und sofort via Twint, Kreditkarte oder bequem auf Rechnung.
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl">
            <h3 className="text-xl font-bold mb-2">Noch keine Abos verfügbar</h3>
            <p className="text-slate-500">Der Club hat noch keine Tarife eingerichtet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto items-center">
            {plans.map((plan, index) => {
              const isPopular = index === Math.floor(plans.length / 2); // Mittlere Karte als Highlight
              
              return (
                <div 
                  key={plan.id}
                  className={`relative rounded-3xl p-8 transition-all hover:scale-[1.02] ${
                    isPopular
                      ? "bg-white dark:bg-[#0A0A0A] border-2 border-clay shadow-2xl transform md:-translate-y-4 z-10"
                      : "bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-white/[0.05] hover:shadow-xl"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-clay text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide">
                      AM BELIEBTESTEN
                    </div>
                  )}
                  
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 min-h-[40px]">
                    {plan.description || "Für aktive Clubmitglieder."}
                  </p>
                  
                  <div className="mb-6">
                    <span className="text-4xl font-extrabold">{Number(plan.price)} {plan.currency}</span>
                    <span className="text-slate-500"> / Jahr</span>
                  </div>
                  
                  {/* Dummy Features - In a real app, these would come from plan.rulesJson */}
                  <ul className="space-y-4 mb-8 text-sm font-medium">
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-clay" />
                      Unlimitiert spielen
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-clay" />
                      Bis zu {plan.simultaneousBookingLimit} Vorausbuchungen
                    </li>
                  </ul>

                  <div className="space-y-3">
                    <CheckoutButton
                      planId={plan.id}
                      paymentMethod="STRIPE"
                      isLoggedIn={isLoggedIn}
                      label="Jetzt abonnieren (Twint/CC)"
                      variant={isPopular ? "default" : "outline"}
                      className={`block w-full text-center py-3 px-4 rounded-xl font-bold transition-all ${
                        isPopular ? "shadow-[0_0_15px_var(--tennis-clay-glow)] hover:shadow-[0_0_25px_var(--tennis-clay-glow)]" : ""
                      }`}
                    />

                    <CheckoutButton
                      planId={plan.id}
                      paymentMethod="OFFLINE_INVOICE"
                      isLoggedIn={isLoggedIn}
                      label="Auf Rechnung zahlen"
                      variant="ghost"
                      className="block w-full text-center py-2 px-4 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Trust & Features Footer */}
        <div className="mt-24 pt-12 border-t border-slate-200 dark:border-white/[0.05] grid md:grid-cols-3 gap-8 text-center text-sm text-slate-500">
          <div>
            <span className="block font-bold text-slate-900 dark:text-white mb-1">Sekundenschnell freigeschaltet</span>
            Nach Zahlung via Twint bist du sofort buchungsberechtigt.
          </div>
          <div>
            <span className="block font-bold text-slate-900 dark:text-white mb-1">Volle Transparenz</span>
            Verwalte deine Rechnungen und dein Abo im Self-Service Portal.
          </div>
          <div>
            <span className="block font-bold text-slate-900 dark:text-white mb-1">Sicher bezahlen</span>
            Zahlungsabwicklung via Stripe. Höchste Sicherheitsstandards.
          </div>
        </div>

      </div>
    </div>
  );
}
