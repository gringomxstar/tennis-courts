import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { getCourtsByTenantId, getTenantMembers } from "@/lib/data";
import { Navbar } from "@/components/navbar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateCourtBlockForm } from "@/components/admin/create-court-block-form";
import { Shield, Calendar, Users, Wrench, ChevronLeft } from "lucide-react";

interface ClubAdminPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
}

export default async function ClubAdminPage({ params }: ClubAdminPageProps) {
  const { clubSlug } = await params;
  const context = await requireTenantAdmin(clubSlug);
  const tenant = context.tenant;

  const [courts, members] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getTenantMembers(tenant.id),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar currentTenant={tenant} user={context.user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Breadcrumb / Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href={`/c/${tenant.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Zurück zum Buchungskalender
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-600" />
              Club-Administration: {tenant.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Verwalte Plätze, Sperrzeiten, Mitglieder und Buchungseinstellungen.
            </p>
          </div>

          <Link href={`/c/${tenant.slug}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
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
                <span>Plätze & Infrastruktur</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {courts.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>• {courts.filter((c) => c.surface === "CLAY").length} Sandplätze</p>
                <p>• {courts.filter((c) => c.hasLighting).length} Plätze mit Flutlicht</p>
                <p>• {courts.filter((c) => c.isIndoor).length} Hallenplätze</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                <span>Registrierte Mitglieder</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {members.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>• {members.filter((m) => m.role === "CLUB_ADMIN").length} Administratoren</p>
                <p>• {members.filter((m) => m.role === "MEMBER").length} Aktive Clubmitglieder</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                <span>Buchungsregeln</span>
                <Badge variant="outline" className="text-[10px] text-emerald-700">Aktiv</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>• Zeiten: {tenant.settingsJson?.openingHour || 7}:00 - {tenant.settingsJson?.closingHour || 22}:00</p>
                <p>• Storno-Frist: {tenant.settingsJson?.cancellationDeadlineHours || 24} Stunden</p>
                <p>• Slot-Dauer: {tenant.settingsJson?.slotDurationMinutes || 60} Minuten</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two-Column Layout: Left = Courts & Members, Right = Court Block Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Courts & Members (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Courts Management List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  🎾 Tennisplätze des Clubs
                </CardTitle>
                <CardDescription className="text-xs">
                  Übersicht aller bespielbaren Plätze und deren Ausstattung
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
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          {court.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <span>{court.surface === "CLAY" ? "Sandplatz" : "Hartplatz"}</span>
                          <span>•</span>
                          <span>{court.isIndoor ? "Halle" : "Outdoor"}</span>
                          {court.hasLighting && <span>• Flutlicht vorhanden</span>}
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

            {/* Members List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Mitgliederverzeichnis ({members.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Zugriffsberechtigte Spieler und Administratoren für {tenant.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>

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
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Court Block / Sperrzeiten Form */}
          <div className="space-y-6">
            <Card className="border-amber-200 dark:border-amber-900/60">
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
        </div>
      </main>
    </div>
  );
}
