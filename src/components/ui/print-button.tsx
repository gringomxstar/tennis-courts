"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      onClick={() => window.print()}
      className="h-auto px-6 py-3 rounded-xl shadow-lg"
    >
      <Printer className="w-5 h-5" />
      Rechnung als PDF speichern / Drucken
    </Button>
  );
}
