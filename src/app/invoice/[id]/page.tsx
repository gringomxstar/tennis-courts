import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/ui/print-button";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const today = new Date().toLocaleDateString("de-CH");
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("de-CH");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] py-12 px-4 selection:bg-blue-500/30">
      <div className="max-w-2xl mx-auto">
        
        {/* Success Header */}
        <div className="mb-8 text-center print:hidden">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Abo erfolgreich reserviert!</h1>
          <p className="text-slate-500 mt-2">
            Dein Zugang wird freigeschaltet, sobald die Zahlung bei uns eingegangen ist.
          </p>
        </div>

        {/* Die eigentliche Rechnung (Print-optimiert) */}
        <div className="bg-white dark:bg-[#111111] text-slate-900 dark:text-slate-100 p-10 md:p-14 rounded-3xl shadow-xl border border-slate-200 dark:border-white/[0.05] print:shadow-none print:border-none print:p-0">
          
          <div className="flex justify-between items-start mb-16">
            <div>
              <h2 className="text-2xl font-black tracking-tighter">TC MARLY</h2>
              <p className="text-sm text-slate-500 mt-1">Route de la Gérine 1<br/>1723 Marly<br/>Schweiz</p>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Rechnung</h3>
              <p className="font-mono text-lg">#RE-2024-{Math.floor(Math.random() * 9000) + 1000}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-16">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rechnung an</p>
              <p className="font-medium">Alain Testkunde</p>
              <p className="text-slate-500 text-sm">alain@example.com</p>
            </div>
            <div className="text-right">
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Rechnungsdatum</p>
                <p className="font-medium">{today}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Zahlbar bis</p>
                <p className="font-medium text-rose-600 dark:text-rose-400">{dueDate}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-b border-slate-200 dark:border-white/[0.1] py-4 mb-8">
            <div className="flex justify-between text-sm font-bold mb-4 px-2 text-slate-400 uppercase tracking-wider">
              <span>Beschreibung</span>
              <span>Betrag</span>
            </div>
            <div className="flex justify-between font-medium text-lg px-2">
              <span>Sommer Abo (Saison 2024)</span>
              <span>350.00 CHF</span>
            </div>
          </div>

          <div className="flex justify-end mb-16 px-2">
            <div className="text-right">
              <p className="text-sm text-slate-500 mb-1">Zwischensumme: 350.00 CHF</p>
              <p className="text-sm text-slate-500 mb-2">MwSt (0%): 0.00 CHF</p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-500 border-t-2 border-slate-900 dark:border-white pt-2 mt-2">
                Total: 350.00 CHF
              </p>
            </div>
          </div>

          {/* Zahlungsanweisungen / E-Banking */}
          <div className="bg-slate-50 dark:bg-black/50 rounded-2xl p-6 border border-slate-200 dark:border-white/[0.05]">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              🏦 E-Banking Zahlungsinformationen
            </h4>
            <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <span className="text-slate-500">Bank:</span>
              <span className="font-medium">Freiburger Kantonalbank</span>
              
              <span className="text-slate-500">IBAN:</span>
              <span className="font-mono font-bold tracking-wide">CH93 0079 0012 3456 7890 1</span>
              
              <span className="text-slate-500">Zugunsten von:</span>
              <span className="font-medium">Tennis Club Marly</span>
              
              <span className="text-slate-500">Mitteilung:</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                ABO-ALAIN-2024
              </span>
            </div>
          </div>
          
          {/* Print Button */}
          <div className="mt-12 text-center print:hidden">
             <PrintButton />
             <div className="mt-6">
                <Link href="/" className="text-sm text-slate-500 hover:text-blue-500 underline underline-offset-4">
                  Zurück zum Dashboard
                </Link>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
