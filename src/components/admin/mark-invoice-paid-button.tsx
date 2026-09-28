"use client";

import { useState } from "react";
import { markInvoiceAsPaidManually } from "@/actions/admin-billing";
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
      <span className="shrink-0 rounded-full bg-paid-bg px-3 py-1 text-[13px] font-bold text-paid-fg">Freigeschaltet</span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleMark}
      disabled={loading}
      className="shrink-0 rounded-[12px] bg-clay px-3.5 py-2 text-[14px] font-bold text-white active:scale-[.97] disabled:opacity-70"
      title={`${planName} für ${userName} als bezahlt markieren`}
    >
      {loading ? "Markiert…" : "Rechnung bezahlt"}
    </button>
  );
}
