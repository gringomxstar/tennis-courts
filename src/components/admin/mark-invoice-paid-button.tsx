"use client";

import { useState } from "react";
import { markInvoiceAsPaidManually } from "@/actions/admin-billing";
import { Button } from "@/components/ui/button";
import { Receipt, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface MarkInvoicePaidButtonProps {
  tenantId: string;
  userId: string;
  userName: string;
  stripeCustomerId: string;
  planName: string;
}

export function MarkInvoicePaidButton({
  tenantId,
  userId,
  userName,
  stripeCustomerId,
  planName,
}: MarkInvoicePaidButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleMark = async () => {
    setLoading(true);
    const res = await markInvoiceAsPaidManually(tenantId, userId, stripeCustomerId);
    setLoading(false);
    if (res.success) {
      setSuccess(true);
    } else {
      toast.error(res.error || "Rechnung konnte nicht als bezahlt markiert werden.");
    }
  };

  if (success) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] h-7 px-2.5 text-emerald-700 dark:text-emerald-400 font-semibold">
        <Check className="w-3 h-3" /> Freigeschaltet
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMark}
      disabled={loading}
      className="text-[11px] h-7 px-2.5 rounded-lg gap-1.5 border-amber-200 hover:bg-amber-50 text-amber-800 dark:border-amber-800 dark:text-amber-300 cursor-pointer"
      title={`${planName} für ${userName} als bezahlt markieren`}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <>
          <Receipt className="w-3 h-3" />
          <span>Rechnung als bezahlt markieren</span>
        </>
      )}
    </Button>
  );
}
