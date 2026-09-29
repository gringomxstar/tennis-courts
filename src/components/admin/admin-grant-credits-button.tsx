"use client";

import { useState } from "react";
import { grantAdminCreditsAction } from "@/app/actions/booking";

interface AdminGrantCreditsButtonProps {
  clubSlug: string;
  userId: string;
  userName: string;
}

export function AdminGrantCreditsButton({
  clubSlug,
  userId,
  userName,
}: AdminGrantCreditsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleGrant = async () => {
    setLoading(true);
    const res = await grantAdminCreditsAction({
      clubSlug,
      userId,
      amount: 25,
      reason: "Witterungsausfall / Admin-Kompensation",
    });
    setLoading(false);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGrant}
      disabled={loading || success}
      className={`shrink-0 h-8 rounded-full px-3 text-[13px] font-bold ${
        success ? "bg-paid-bg text-paid-fg" : "bg-inset text-clay-text disabled:opacity-60"
      }`}
      title={`+25 CHF Credits gutschreiben für ${userName}`}
    >
      {loading ? "Bucht…" : success ? "+25 CHF gebucht" : "+25 CHF Gutschrift"}
    </button>
  );
}
