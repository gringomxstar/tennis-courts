"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { cancelBookingAction } from "@/app/actions/booking";

interface CancelBookingButtonProps {
  bookingId: string;
  clubSlug: string;
  courtName: string;
  formattedTime: string;
}

export function CancelBookingButton({
  bookingId,
  clubSlug,
  courtName,
  formattedTime,
}: CancelBookingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);

    const res = await cancelBookingAction(bookingId, clubSlug);
    setIsPending(false);

    if (res.success) {
      setIsOpen(false);
    } else {
      setError(res.error || "Stornierung fehlgeschlagen.");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/60 rounded-xl gap-1.5 h-8 font-semibold cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Stornieren
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#141A26] border border-slate-200 dark:border-white/[0.08] space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Reservierung stornieren?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Der reservierte Platz wird für andere Mitglieder freigegeben.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#101522] border border-slate-200/80 dark:border-white/[0.06] space-y-1 text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {courtName}
              </div>
              <div className="text-slate-500 font-mono">
                {formattedTime}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="rounded-xl text-xs"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-xl text-xs gap-1.5 bg-rose-600 hover:bg-rose-700"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ja, Reservierung aufheben
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
