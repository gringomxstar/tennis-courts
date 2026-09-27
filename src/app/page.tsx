import Link from "next/link";
import { auth } from "@/auth";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { getAllTenants } from "@/lib/data";
import {
  Calendar,
  ShieldCheck,
  Zap,
  ChevronRight,
  MapPin,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";

export default async function Home() {
  const session = await auth();
  const tenants = await getAllTenants();

  const navbarUser = session?.user
    ? {
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.name,
        role: session.user.role,
        isPlatformAdmin: session.user.isPlatformAdmin,
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 tennis-grid-bg">
      {/* Navigation Header */}
      <Navbar user={navbarUser} />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32">
        {/* Subtle decorative glowing mesh balls */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-amber-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 text-xs font-bold mb-6 border border-emerald-200/80 dark:border-emerald-800 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Next-Gen Tennis Reservation & Club OS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.08]">
            Dein Match beginnt hier.{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 bg-clip-text text-transparent">
              Tennisplätze
            </span>{" "}
            in Echtzeit buchen.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Schluss mit veralteten Buchungstafeln und Excel-Listen.
            Modernes Club-Management mit atomarer PostgreSQL-Kollisionsvermeidung, flexiblen Tarifen und reaktionsschnellem Court-Grid.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3.5 justify-center max-w-md mx-auto">
            <Link href="/c/tc-rot-weiss" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-6 rounded-2xl shadow-lg shadow-emerald-600/25 transition-all hover:scale-102"
              >
                <Calendar className="w-4 h-4" />
                Demo-Club Kalender
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto gap-2 font-semibold h-12 px-6 rounded-2xl border-slate-300 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 transition-all"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                1-Klick Demo Login
              </Button>
            </Link>
          </div>

          {/* High-Impact Stat Pills */}
          <div className="mt-14 pt-8 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 shadow-xs backdrop-blur-md">
              <div className="text-2xl font-black text-slate-900 dark:text-white">0</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Doppelbuchungen (GiST Lock)</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 shadow-xs backdrop-blur-md">
              <div className="text-2xl font-black text-slate-900 dark:text-white">&lt; 30s</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Schnelle Buchungszeit</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 shadow-xs backdrop-blur-md">
              <div className="text-2xl font-black text-slate-900 dark:text-white">100%</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Mandantentrennung</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 shadow-xs backdrop-blur-md">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">Live</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Echtzeit-Verfügbarkeit</div>
            </div>
          </div>
        </div>
      </section>

      {/* Available Clubs Section */}
      <section id="clubs" className="py-16 bg-white/60 dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1 block">
              Multi-Tenant Plattform
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Wähle deinen Tennisclub
            </h2>
            <p className="mt-2 text-slate-500 text-sm max-w-xl mx-auto">
              Jeder Club verfügt über seine eigene Subroute, Tarife, Plätze und individuelle Buchungsregeln.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {tenants.map((club) => (
              <div
                key={club.slug}
                className="group relative p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {club.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{club.address || "Zürich, Schweiz"}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Aktiv
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                      🎾 Sandplätze
                    </span>
                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                      💡 Flutlicht
                    </span>
                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      ⏰ {club.settingsJson?.openingHour || 7}:00 - {club.settingsJson?.closingHour || 22}:00
                    </span>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">/c/{club.slug}</span>
                  <Link href={`/c/${club.slug}`}>
                    <Button
                      size="sm"
                      className="bg-slate-900 text-white hover:bg-emerald-600 dark:bg-white dark:text-slate-900 dark:hover:bg-emerald-500 dark:hover:text-white rounded-xl text-xs font-semibold gap-1.5 transition-colors"
                    >
                      <span>Kalender öffnen</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Konzipiert für reibungslose Spieltage
          </h2>
          <p className="mt-2 text-slate-500 text-sm max-w-xl mx-auto">
            Robuste Technik für Administratoren und spielerische Leichtigkeit für Clubmitglieder.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 shadow-xs hover:shadow-md transition-all">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Atomarer Kollisionsschutz
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              PostgreSQL Exclusion Constraints garantieren auf Datenbankebene, dass kein Platz jemals zur selben Zeit doppelt belegt wird.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 shadow-xs hover:shadow-md transition-all">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Dynamische Club-Regeln
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Öffnungszeiten, Vorlauffristen, Spieldauern (60/90 Min.) und Stornobedingungen lassen sich clubspezifisch anpassen.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 shadow-xs hover:shadow-md transition-all">
            <div className="h-12 w-12 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center mb-4">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Flexible Mitgliedschaftstarife
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Verwalte Quoten und Buchungslimits für Aktivmitglieder, Junioren, Senioren oder Gastspieler mit wenigen Klicks.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-950/40 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-base">🎾</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">TennisCourts Pro</span>
            <span>— Mandantenfähige Tennis-Reservierung</span>
          </div>
          <div>Next.js 16 • Tailwind CSS • Neon PostgreSQL • Auth.js v5</div>
        </div>
      </footer>
    </div>
  );
}
