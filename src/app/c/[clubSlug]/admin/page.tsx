import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import {
  getCourtsByTenantId,
  getTenantMembers,
  getMembershipPlansByTenantId,
  getUserWallet,
} from "@/lib/data";
import { Navbar } from "@/components/navbar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateCourtBlockForm } from "@/components/admin/create-court-block-form";
import { ClubSettingsForm } from "@/components/admin/club-settings-form";
import { MembershipPlansManager } from "@/components/admin/membership-plans-manager";
import { AdminGrantCreditsButton } from "@/components/admin/admin-grant-credits-button";
import { MarkInvoicePaidButton } from "@/components/admin/mark-invoice-paid-button";
import { Shield, Calendar, Users, Wrench, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";

interface ClubAdminPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
}

export default async function ClubAdminPage({ params }: ClubAdminPageProps) {
  const { clubSlug } = await params;
  const context = await requireTenantAdmin(clubSlug);
  const tenant = context.tenant;

  const [courts, members, membershipPlans, wallet] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getTenantMembers(tenant.id),
    getMembershipPlansByTenantId(tenant.id),
    context.user?.id ? getUserWallet(tenant.id, context.user.id) : null,
  ]);

  // Offline-invoice memberships awaiting manual payment confirmation. Membership purchase
  // is Postgres/Stripe-only (see api/checkout/route.ts) — no mockDb equivalent exists, so
  // this queries Prisma directly rather than going through the dual-backend data layer.
  const pendingByUserId = new Map<string, { stripeCustomerId: string; planName: string }>();
  if (process.env.DATABASE_URL) {
    const pending = await prisma.membership.findMany({
      where: { tenantId: tenant.id, status: "PENDING" },
      include: { user: true, plan: true },
    });
    for (const m of pending) {
      if (m.user.stripeCustomerId) {
        pendingByUserId.set(m.userId, { stripeCustomerId: m.user.stripeCustomerId, planName: m.plan.name });
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar currentTenant={tenant} user={context.user} wallet={wallet} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Breadcrumb / Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href={`/c/${tenant.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:text-clay-hover mb-2 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Zurück zum Buchungskalender
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-600" />
              Club-Administration: {tenant.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Dynamische Konfiguration von Öffnungszeiten, Tarifen, TC Marly Fairplay-Regeln, Plätzen und Credits.
            </p>
          </div>

          <Link href={`/c/${tenant.slug}`}>
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Kalender ansehen
            </Button>
          </Link>
        </div>

        {/* Top Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                <span>Plätze & Multi-Sport</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {courts.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>• {courts.filter((c) => c.sportType === "TENNIS").length} Tennisplätze</p>
                <p>• {courts.filter((c) => c.sportType === "PADEL").length} Padel Courts</p>
                <p>• {courts.filter((c) => c.isIndoor).length} Hallenplätze</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                <span>Mitglieder & Tarife</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {members.length} / {membershipPlans.length} Tarife
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>• {members.filter((m) => m.role === "CLUB_ADMIN").length} Administratoren</p>
                <p>• {members.filter((m) => m.role === "MEMBER").length} Aktive Clubmitglieder</p>
                <p>• {membershipPlans.length} Konfigurierte Mitgliedschaftstarife</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                <span>Aktive Buchungsregeln</span>
                <Badge variant="outline" className="text-[10px] text-emerald-700 font-bold">
                  {tenant.settingsJson?.marlyRuleEnabled ? "Marly Fairplay Aktiv" : "Standard"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>• Zeiten: {tenant.settingsJson?.openingHour || 7}:00 - {tenant.settingsJson?.closingHour || 22}:00 Uhr</p>
                <p>• Max. Slots: {tenant.settingsJson?.maxActiveSlotsPerPlayer || 2} gleichzeitig</p>
                <p>• 2h Doppel: {tenant.settingsJson?.allowConsecutiveSlotsForDoubles ? "Erlaubt (4 Spieler)" : "Deaktiviert"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 1: Settings Form & Court Block Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClubSettingsForm
            clubSlug={tenant.slug}
            initialSettings={tenant.settingsJson}
          />

          <Card className="border-amber-200 dark:border-amber-900/60 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                Platzsperre erfassen
              </CardTitle>
              <CardDescription className="text-xs">
                Sperre Plätze für Wartungsarbeiten, Turniere oder schlechtes Wetter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateCourtBlockForm clubSlug={tenant.slug} courts={courts} />
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Membership Plans & Courts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MembershipPlansManager
            clubSlug={tenant.slug}
            initialPlans={membershipPlans}
          />

          {/* Courts Management List */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Plätze & Multi-Sport ({courts.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Übersicht aller bespielbaren Tennis- und Padel-Plätze mit Stundensätzen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          {court.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {court.sportType === "PADEL" ? "Padel" : "Tennis"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span>{court.surface === "CLAY" ? "Sandplatz" : court.surface === "CARPET" ? "Teppich" : "Hartplatz"}</span>
                        <span>•</span>
                        <span>{court.isIndoor ? "Halle" : "Outdoor"}</span>
                        {court.hasLighting && <span>• Flutlicht</span>}
                        <span>•</span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{court.hourlyRate} CHF/h</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        {court.status === "ACTIVE" ? "Bespielbar" : "Wartung"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Members List & Admin Credit Granting */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Mitgliederverzeichnis & Credit-Gutschriften ({members.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Zugriffsberechtigte Spieler für {tenant.name}. Admins können Mitgliedern bei Schlechtwetter oder Stornierungen direkt Credits gutschreiben.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {pendingByUserId.has(member.id) && (
                      <MarkInvoicePaidButton
                        tenantId={tenant.id}
                        userId={member.id}
                        userName={`${member.firstName} ${member.lastName}`}
                        stripeCustomerId={pendingByUserId.get(member.id)!.stripeCustomerId}
                        planName={pendingByUserId.get(member.id)!.planName}
                      />
                    )}

                    <AdminGrantCreditsButton
                      clubSlug={tenant.slug}
                      userId={member.id}
                      userName={`${member.firstName} ${member.lastName}`}
                    />

                    <Badge
                      variant={member.role === "CLUB_ADMIN" ? "default" : "secondary"}
                      className={
                        member.role === "CLUB_ADMIN"
                          ? "bg-amber-600 text-white text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {member.role === "CLUB_ADMIN" ? "Club Admin" : "Mitglied"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
