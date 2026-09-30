/** Signs sessions and booking/password links. No public fallback in production: a known secret means forgeable admin sessions. */
export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return "dev-only-secret-not-for-production-use-0000";
}
