"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button 
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-black text-white rounded-xl font-bold transition-all shadow-lg"
    >
      <Printer className="w-5 h-5" />
      Rechnung als PDF speichern / Drucken
    </button>
  );
}
