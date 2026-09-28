// Runs wallet debit/refund/credit against the real DB inside a transaction that is always rolled back.
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { creditWallet, debitWallets, InsufficientFundsError, refundBookingWallets } from "../src/lib/wallet";

const ROLLBACK = new Error("rollback");
(async () => {
  const tu = await prisma.tenantUser.findFirstOrThrow({ where: { role: "MEMBER" } });
  const { tenantId, userId } = tu;
  const bal = async (tx: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) =>
    Number((await tx.userWallet.findUnique({ where: { tenantId_userId: { tenantId, userId } } }))?.balance ?? 0);
  const before = await bal(prisma);
  await prisma
    .$transaction(async (tx) => {
      await creditWallet(tx, tenantId, userId, 30, "ADMIN_GRANT", "test");
      assert.equal(await bal(tx), before + 30);
      await debitWallets(tx, tenantId, [{ userId, amount: 20 }], "test-booking", "test");
      assert.equal(await bal(tx), before + 10);
      await assert.rejects(
        debitWallets(tx, tenantId, [{ userId, amount: before + 11 }], "test-booking-2", "test"),
        InsufficientFundsError
      );
      assert.equal(await bal(tx), before + 10);
      assert.equal(await refundBookingWallets(tx, "test-booking", "refund"), 20);
      assert.equal(await bal(tx), before + 30);
      assert.equal(await refundBookingWallets(tx, "no-such-booking", "refund"), 0);
      throw ROLLBACK;
    }, { timeout: 20_000 })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
  assert.equal(await bal(prisma), before);
  console.log("wallet db ok (rolled back)");
  await prisma.$disconnect();
})();
