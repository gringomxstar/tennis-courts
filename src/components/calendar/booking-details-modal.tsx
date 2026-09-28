"use client";

import { useState } from "react";
import { Booking } from "@/types";
import { cancelBookingAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Calendar, AlertTriangle, Loader2, CheckCircle2, Clock, XCircle, Trophy } from "lucide-react";
import { formatTime24 } from "@/lib/utils";

interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  clubSlug: string;
  currentUserId?: string;
  isClubAdmin?: boolean;
}

export function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
  clubSlug,
  currentUserId,
  isClubAdmin,
}: BookingDetailsModalProps) {
  const [cancelling, setCancelling] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking) return null;

  const isOrganizer = currentUserId && booking.organizerId === currentUserId;
  const canCancel = isOrganizer || isClubAdmin;

  const startDate = new Date(booking.startsAt);
  const endDate = new Date(booking.endsAt);

  const formattedDate = startDate.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedStartTime = formatTime24(startDate);
  const formattedEndTime = formatTime24(endDate);

  const opponent = booking.participants.find((p) => p.role !== "ORGANIZER");
  const opponentName = opponent?.user
    ? `${opponent.user.firstName} ${opponent.user.lastName}`
    : opponent?.guestName || "Kein Spielpartner angegeben";

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);

    const res = await cancelBookingAction(booking.id, clubSlug);
    setCancelling(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || "Fehler beim Stornieren der Buchung.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-card border-border p-6 sm:max-w-md">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-clay" /> Buchungsdetails
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {booking.court?.name || "Tennisplatz"}
              </Badge>
              {isOrganizer && (
                <Badge className="bg-clay text-white text-[10px]">Deine Buchung</Badge>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-3.5 text-sm">
          {/* Date & Time */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-muted border border-border">
            <Calendar className="w-5 h-5 text-clay shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">{formattedDate}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {formattedStartTime} – {formattedEndTime} Uhr
              </p>
            </div>
          </div>

          {/* Players */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-border bg-muted">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Bucher / Spieler 1
              </span>
              <p className="font-semibold text-foreground mt-1">
                {booking.organizer
                  ? `${booking.organizer.firstName} ${booking.organizer.lastName}`
                  : "Organisator"}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-muted">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Partner / Spieler 2
              </span>
              <p className="font-semibold text-foreground mt-1">{opponentName}</p>
            </div>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="p-3 rounded-xl bg-muted border border-border">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Notizen
              </span>
              <p className="text-slate-700 dark:text-slate-300 mt-0.5 text-xs italic">
                „{booking.notes}“
              </p>
            </div>
          )}

          {/* Status info */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-border">
            {booking.status === "PENDING" ? (
              <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                <Clock className="w-4 h-4" /> Wartet auf Zahlungsbestätigung
              </span>
            ) : booking.status === "CANCELLED" ? (
              <span className="flex items-center gap-1.5 text-rose-500 font-medium">
                <XCircle className="w-4 h-4" /> Storniert
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Bestätigt & reserviert
              </span>
            )}
            <span>ID: {booking.id.substring(0, 14)}...</span>
          </div>
        </div>

        {/* Cancellation Section */}
        {canCancel && (
          <div className="mt-6 pt-4 border-t border-border">
            {!confirmPrompt ? (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setConfirmPrompt(true)}
              >
                Reservierung stornieren
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-red-600 font-medium text-center">
                  Möchtest du diese Reservierung wirklich unwiderruflich stornieren?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmPrompt(false)}
                    disabled={cancelling}
                  >
                    Nein, behalten
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="gap-2"
                  >
                    {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                    Ja, stornieren
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
