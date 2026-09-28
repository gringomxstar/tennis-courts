import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, CreditCard, LogOut, User as UserIcon } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      tenantUsers: true,
      memberships: {
        include: {
          plan: true
        }
      }
    }
  });

  if (!user) {
    redirect("/login");
  }

  const activeMembership = user.memberships.find(m => m.status === "ACTIVE" || m.status === "PENDING");
  const role = user.tenantUsers[0]?.role || "GUEST";

  return (
    <div className="min-h-screen bg-background py-12 px-4 selection:bg-clay/30">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-black text-foreground">Mein Profil</h1>
            <p className="text-slate-500 mt-1">Willkommen zurück, {user.firstName || user.email}</p>
          </div>
          
          <form action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}>
            <button type="submit" className="flex items-center gap-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-4 py-2 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </form>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Status Card */}
          <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-clay/10 text-clay rounded-full flex items-center justify-center">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Aktueller Status</h2>
                <div className={`text-sm font-semibold mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full ${
                  role === "MEMBER" 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                }`}>
                  {role === "MEMBER" ? "Aktives Mitglied" : "Gast / Nicht-Mitglied"}
                </div>
              </div>
            </div>

            {activeMembership ? (
              <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                <p className="text-sm text-slate-500 mb-1">Dein aktuelles Abo:</p>
                <p className="font-bold text-lg">{activeMembership.plan.name}</p>
                <p className="text-sm mt-2 flex items-center gap-2">
                  Status: 
                  <span className={activeMembership.status === "ACTIVE" ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                    {activeMembership.status}
                  </span>
                </p>
                {activeMembership.status === "PENDING" && (
                  <p className="text-xs text-slate-400 mt-2">
                    Dein Abo ist noch auf "Ausstehend" (Rechnung unbezahlt). Sobald die Zahlung eintrifft, schaltet es auf ACTIVE.
                  </p>
                )}
              </div>
            ) : (
              <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                <p className="text-slate-500 text-sm mb-4">Du hast momentan kein aktives Abo.</p>
                <Link href="/membership" className="inline-flex items-center gap-2 text-sm font-bold text-clay hover:underline">
                  <CreditCard className="w-4 h-4" />
                  Abo kaufen
                </Link>
              </div>
            )}
          </div>

          {/* Actions Card */}
          <div className="bg-card p-8 rounded-3xl border border-border shadow-sm flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-clay/10 text-clay rounded-2xl flex items-center justify-center mb-6">
              <Calendar className="w-8 h-8" />
            </div>
            <h2 className="font-bold text-xl mb-2">Auf den Platz!</h2>
            <p className="text-slate-500 text-sm mb-8">
              Reserviere deinen Court. Gäste zahlen direkt per Twint/Kreditkarte, Mitglieder buchen kostenlos.
            </p>
            <Link
              href="/c/tc-marly"
              className="w-full py-4 px-6 bg-clay hover:bg-clay-hover text-white font-bold rounded-xl transition-all shadow-lg"
            >
              Zum Kalender
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
