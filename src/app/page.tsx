import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ShieldCheck, Users, Trophy, ChevronRight, MapPin } from "lucide-react";

export default function Home() {
  const demoClubs = [
    {
      name: "TC Rot-Weiss Zürich",
      slug: "tc-rot-weiss",
      courts: 6,
      location: "Zürich-Fluntern",
      surface: "Sand & Allwetter",
    },
    {
      name: "Tennis Club Obersee",
      slug: "tc-obersee",
      courts: 4,
      location: "Rapperswil",
      surface: "Halle & Sand",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold">
              🎾
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
              TennisCourts
            </span>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[10px]">
              Multi-Tenant
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Anmelden
              </Button>
            </Link>
            <Link href="#clubs">
              <Button size="sm">Club wählen</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-medium mb-6">
            <ShieldCheck className="w-3.5 h-3.5" />
            Konfliktfreie Buchungen mit PostgreSQL Exclusion Constraints
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Tennisplätze einfach & <span className="text-emerald-600">zuverlässig</span> reservieren
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Die moderne Plattform für Tennisclubs: flexible Buchungsregeln, Echtzeit-Platzbelegung,
            Gastbuchungen und mandantenfähige Administration.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/c/tc-rot-weiss">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                <Calendar className="w-4 h-4" />
                Demo Club Kalender öffnen
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Funktionen entdecken
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Demo Clubs Section */}
      <section id="clubs" className="py-16 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Verfügbare Clubs
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">
              Wähle deinen Tennisclub, um verfügbare Plätze einzusehen und Buchungen vorzunehmen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {demoClubs.map((club) => (
              <Card key={club.slug} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{club.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {club.location}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{club.courts} Plätze</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Belag: <span className="font-medium text-slate-700 dark:text-slate-300">{club.surface}</span>
                  </div>
                  <Link href={`/c/${club.slug}`} className="block">
                    <Button variant="outline" className="w-full justify-between" size="sm">
                      Zum Buchungskalender
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            Für Clubs, Mitglieder und Trainer gebaut
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-xl mx-auto text-sm">
            Entwickelt für maximale Auslastung, minimale Konflikte und reibungslose Abläufe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400 mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <CardTitle>Keine Doppelbuchungen</CardTitle>
              <CardDescription>
                Dank PostgreSQL Exclusion Constraints und Transaktionen sind überlappende Reservierungen technisch ausgeschlossen.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-400 mb-2">
                <Users className="w-5 h-5" />
              </div>
              <CardTitle>Flexible Tarife & Regeln</CardTitle>
              <CardDescription>
                Passgenaue Quoten (z.B. max. 4 zukünftige Buchungen), Buchungsfenster, Abendquoten und Spielregeln je Mitgliedschaft.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-2">
                <Trophy className="w-5 h-5" />
              </div>
              <CardTitle>Mobile-First Kalender</CardTitle>
              <CardDescription>
                Schnelle, responsive Platzübersicht. Plätze als Spalten, Zeitslots als Zeilen – direkt vom Smartphone aus buchbar.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} Tennis Reservation App. Alle Rechte vorbehalten.</div>
          <div className="flex items-center gap-6">
            <span>Next.js 16</span>
            <span>Neon PostgreSQL</span>
            <span>Vercel Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
