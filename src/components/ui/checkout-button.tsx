"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

interface CheckoutButtonProps {
  planId: string;
  paymentMethod: "STRIPE" | "OFFLINE_INVOICE";
  isLoggedIn: boolean;
  label: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  className?: string;
}

export function CheckoutButton({ planId, paymentMethod, isLoggedIn, label, variant = "default", className }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      // Leite Nicht-Eingeloggte zum Login, mit Return-URL zur Membership-Seite
      router.push(`/register?callbackUrl=/membership`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, paymentMethod }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect zu Stripe Checkout ODER zu unserer Offline-Rechnungs-Ansicht
        window.location.href = data.url;
      } else {
        alert(data.error || "Ein Fehler ist aufgetreten.");
      }
    } catch (error) {
      alert("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleCheckout}
      disabled={isLoading}
      className={`h-auto transition-all ${className} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {isLoading ? "Wird geladen..." : label}
    </Button>
  );
}
