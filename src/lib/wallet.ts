import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

type Tx = Prisma.TransactionClient;

export class InsufficientFundsError extends Error {
  constructor(public userId: string) {
    super("Nicht genügend Guthaben.");
  }
}

/** Charge each user's club wallet inside the caller's transaction. Throws InsufficientFundsError, rolling everything back. */
export async function debitWallets(
  tx: Tx,
  tenantId: string,
  charges: { userId: string; amount: number }[],
  bookingId: string,
  description: string
) {
  for (const c of charges) {
    if (c.amount <= 0) continue;
    // conditional decrement: never goes negative, safe against two concurrent bookings
    const res = await tx.userWallet.updateMany({
      where: { tenantId, userId: c.userId, balance: { gte: c.amount } },
      data: { balance: { decrement: c.amount } },
    });
    if (res.count === 0) throw new InsufficientFundsError(c.userId);
    const w = await tx.userWallet.findUniqueOrThrow({ where: { tenantId_userId: { tenantId, userId: c.userId } } });
    await tx.walletTransaction.create({
      data: { walletId: w.id, amount: -c.amount, type: "BOOKING_PAYMENT", description, bookingId },
    });
  }
}

/** Give back every wallet payment made for this booking. Call only once per booking (after the CANCELLED transition). */
export async function refundBookingWallets(tx: Tx, bookingId: string, description: string) {
  const paid = await tx.walletTransaction.findMany({ where: { bookingId, type: "BOOKING_PAYMENT" } });
  let total = 0;
  for (const p of paid) {
    const amount = -Number(p.amount);
    await tx.userWallet.update({ where: { id: p.walletId }, data: { balance: { increment: amount } } });
    await tx.walletTransaction.create({ data: { walletId: p.walletId, amount, type: "REFUND", description, bookingId } });
    total += amount;
  }
  return total;
}

export async function creditWallet(
  tx: Tx,
  tenantId: string,
  userId: string,
  amount: number,
  type: "TOP_UP" | "ADMIN_GRANT",
  description: string,
  stripeSessionId?: string
) {
  const w = await tx.userWallet.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: { tenantId, userId, balance: amount },
    update: { balance: { increment: amount } },
  });
  await tx.walletTransaction.create({ data: { walletId: w.id, amount, type, description, stripeSessionId } });
  return Number(w.balance);
}

/**
 * Credit a paid Stripe top-up session. Idempotent: the webhook and the return page can both call it;
 * a per-session advisory lock serializes them before the "already credited?" check.
 */
export async function creditTopUpSession(sessionId: string) {
  const s = await getStripe().checkout.sessions.retrieve(sessionId);
  const m = s.metadata;
  if (m?.purpose !== "wallet_topup" || s.payment_status !== "paid" || !m.tenantId || !m.userId) return false;
  const amount = (s.amount_total ?? 0) / 100;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${s.id}))`;
    if (await tx.walletTransaction.findFirst({ where: { stripeSessionId: s.id } })) return false;
    await creditWallet(tx, m.tenantId, m.userId, amount, "TOP_UP", `Guthaben aufgeladen (+${amount} CHF)`, s.id);
    return true;
  });
}
