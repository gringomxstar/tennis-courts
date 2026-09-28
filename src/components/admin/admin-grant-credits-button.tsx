"use client";

import { useState } from "react";
import { grantAdminCreditsAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, Check } from "lucide-react";

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
    <Button
      variant="outline"
      size="sm"
      onClick={handleGrant}
      disabled={loading || success}
      className="text-[11px] h-7 px-2.5 rounded-lg gap-1.5 border-emerald-200 hover:bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300 cursor-pointer"
      title={`+25 CHF Credits gutschreiben für ${userName}`}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : success ? (
        <>
          <Check className="w-3 h-3 text-emerald-600" />
          <span>+25 CHF gebucht!</span>
        </>
      ) : (
        <>
          <Coins className="w-3 h-3 text-amber-500" />
          <span>+25 CHF Gutschrift</span>
        </>
      )}
    </Button>
  );
}
