import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Serverless: every instance opens its own pool, and prod + local dev share one DB whose
// role has a low connection cap (P2037 "too many connections", e.g. after several deploys in a row).
// On Vercel the Prisma Postgres integration provides a pooled URL: all instances share one pool.
// Elsewhere (local dev) fall back to the direct URL with a small fixed pool per process.
function pooledUrl() {
  const pooled = process.env.tcstor_PRISMA_DATABASE_URL;
  if (pooled?.startsWith("prisma+postgres://") || pooled?.startsWith("prisma://")) return pooled;
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "3");
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: pooledUrl(),
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
