import Link from "next/link";
import { auth } from "@/auth";
import { ArrowRight, Calendar, CheckCircle2, MapPin, Sparkles, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();
  
  // Für die TC Marly Demo holen wir direkt die Daten
  const tcMarly = await prisma.tenant.findUnique({
    where: { id: "tc-marly" }
  });

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-clay/30">
      {/* Navigation - Minimalist */}
      <nav className="absolute top-0 w-full z-50 px-6 py-6 flex justify-between items-center max-w-7xl mx-auto left-0 right-0">
        <div className="flex items-center gap-2 font-black text-xl tracking-tighter">
          <div className="w-8 h-8 rounded-xl bg-clay flex items-center justify-center text-white">
            <Trophy className="w-5 h-5" />
          </div>
          TC MARLY
        </div>
        <div className="flex items-center gap-4">
          <Link href="/c/tc-marly" className="text-sm font-semibold hover:text-clay transition-colors">
            Kalender
          </Link>
          <Link href="/membership" className="text-sm font-semibold hover:text-clay transition-colors">
            Abos & Preise
          </Link>
          {session ? (
             <Link href="/dashboard" className="text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-black px-5 py-2 rounded-full hover:scale-105 transition-transform">
               Mein Profil
             </Link>
          ) : (
             <Link href="/login" className="text-sm font-bold bg-clay text-white px-5 py-2 rounded-full shadow-[0_0_15px_var(--tennis-clay-glow)] hover:shadow-[0_0_25px_var(--tennis-clay-glow)] hover:scale-105 transition-all">
               Login / Registrieren
             </Link>
          )}
        </div>
      </nav>

      {/* Hero Section (2026 Glassmorphism / Spatial UI Style) */}
      <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden flex flex-col items-center justify-center min-h-[90vh] tennis-grid-bg">

        {/* Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-clay/20 dark:bg-clay/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-floodlight/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-clay/10 text-clay font-semibold text-sm mb-8 ring-1 ring-clay/20 backdrop-blur-md">
            <Sparkles className="w-4 h-4" />
            <span>Offizielle Buchungsplattform Saison 2026</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[1.05]">
            Dein Court.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-clay to-floodlight">
              In Sekunden gebucht.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Willkommen beim {tcMarly?.name || "TC Marly"}. Egal ob spontanes Match am Abend oder festes Sommer-Abo – unsere neue Plattform bringt dich schneller auf den Platz als je zuvor.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/c/tc-marly"
              className="flex items-center gap-2 w-full sm:w-auto px-8 py-4 bg-clay hover:bg-clay-hover text-white font-bold rounded-2xl transition-all shadow-xl hover:scale-105"
            >
              <Calendar className="w-5 h-5" />
              Platz reservieren
            </Link>

            <Link
              href="/membership"
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-card border border-border hover:border-clay/50 font-bold rounded-2xl transition-all shadow-sm hover:shadow-clay/10 group"
            >
              Abo kaufen (Twint/Rechnung)
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Feature Teaser */}
        <div className="relative z-10 mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6 w-full">
          <div className="p-6 rounded-3xl glass-panel backdrop-blur-xl">
            <div className="w-12 h-12 bg-clay/10 text-clay rounded-2xl flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Live-Kalender</h3>
            <p className="text-sm text-slate-500">Sehe in Echtzeit, welche Plätze frei sind und buche mit zwei Klicks.</p>
          </div>

          <div className="p-6 rounded-3xl glass-panel backdrop-blur-xl">
            <div className="w-12 h-12 bg-floodlight/10 text-floodlight rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Auto-Unlock</h3>
            <p className="text-sm text-slate-500">Zahle dein Abo per Twint und das System schaltet dich in der gleichen Sekunde für Buchungen frei.</p>
          </div>

          <div className="p-6 rounded-3xl glass-panel backdrop-blur-xl">
            <div className="w-12 h-12 bg-clay/10 text-clay rounded-2xl flex items-center justify-center mb-4">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Location</h3>
            <p className="text-sm text-slate-500">Route de la Gérine 1, 1723 Marly. 6 Sandplätze, 2 Hallenplätze.</p>
          </div>
        </div>

      </main>
    </div>
  );
}
