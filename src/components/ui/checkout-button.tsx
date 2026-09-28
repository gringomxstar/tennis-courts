"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CheckoutButtonProps {
  planId: string;
  paymentMethod: "STRIPE" | "OFFLINE_INVOICE";
  isLoggedIn: boolean;
  label: string;
  className?: string;
}

export function CheckoutButton({ planId, paymentMethod, isLoggedIn, label, className }: CheckoutButtonProps) {
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
    <button 
      onClick={handleCheckout} 
      disabled={isLoading}
      className={`transition-all ${className} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {isLoading ? "Wird geladen..." : label}
    </button>
  );
}
