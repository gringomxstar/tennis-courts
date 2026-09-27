import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/tenant";
import { getAllTenants, getCourtsByTenantId } from "@/lib/data";
import { Navbar } from "@/components/navbar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Building2, Calendar, Activity } from "lucide-react";
import { TenantRole } from "@/types";

export default async function PlatformAdminPage() {
  const user = await requirePlatformAdmin();
  const tenants = await getAllTenants();

  const tenantStats = await Promise.all(
    tenants.map(async (t) => {
      const courts = await getCourtsByTenantId(t.id);
      return {
        tenant: t,
        courtsCount: courts.length,
      };
    })
  );

  const navbarUser = user
    ? {
        id: user.id,
        email: user.email || "",
        name: user.name,
        role: (user.role || "PLATFORM_ADMIN") as TenantRole,
        isPlatformAdmin: Boolean(user.isPlatformAdmin),
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar user={navbarUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-600 text-white">Plattform-Ebene</Badge>
            <Badge variant="outline">Mandantenverwaltung</Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-8 h-8 text-purple-600" />
            Plattform-Administration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Zentrale Übersicht aller registrierten Tennisclubs, Mandanten und Systemmetriken.
          </p>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                <span>Registrierte Clubs</span>
                <Building2 className="w-4 h-4 text-purple-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {tenants.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">Alle Mandanten aktiv</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                <span>Tennisplätze Gesamt</span>
                <Activity className="w-4 h-4 text-emerald-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {tenantStats.reduce((acc, curr) => acc + curr.courtsCount, 0)}
              </div>
              <p className="text-xs text-slate-500 mt-1">In allen Standorten</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                <span>Multi-Tenancy Status</span>
                <Badge className="bg-emerald-600 text-white text-[10px]">Isoliert</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Path-basiertes Routing aktiv
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Schema: <code className="text-purple-600">/c/[clubSlug]</code>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Aktive Clubs / Mandanten
            </CardTitle>
            <CardDescription className="text-xs">
              Direktzugriff auf den Buchungskalender oder die Club-Administration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tenantStats.map(({ tenant, courtsCount }) => (
                <div
                  key={tenant.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-900 dark:text-white">
                        {tenant.name}
                      </span>
                      <code className="text-xs px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        /c/{tenant.slug}
                      </code>
                    </div>
                    <p className="text-xs text-slate-500">
                      {tenant.address || "Keine Adresse"} &bull; {courtsCount} Plätze
                      &bull; Zeitzone: {tenant.timezone}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/c/${tenant.slug}`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        Kalender
                      </Button>
                    </Link>
                    <Link href={`/c/${tenant.slug}/admin`}>
                      <Button size="sm" className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                        <Shield className="w-3.5 h-3.5" />
                        Club-Admin
                      </Button>
                    </Link>
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
