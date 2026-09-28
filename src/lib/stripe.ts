import Stripe from "stripe";

let client: Stripe | null = null;

// Lazily initialized so a missing key throws a clear error at the call site
// instead of every route silently falling back to a placeholder key that
// makes real Stripe calls fail with a confusing auth error.
export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.length < 20) {
    throw new Error(
      "STRIPE_SECRET_KEY ist nicht konfiguriert. Bitte einen echten Stripe-Test-Key in .env setzen."
    );
  }

  client = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  return client;
}
