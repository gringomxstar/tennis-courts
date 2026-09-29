import { prisma } from "@/lib/prisma";

/** Manual money decisions (paid by hand, waived, Abo assigned/renewed/ended). Shown in the member's history. */
export async function logMoney(o: {
  tenantId: string;
  actorId?: string | null;
  action: string;
  entityType: "Booking" | "Membership";
  entityId: string;
  /** the member it concerns */
  userId: string;
  text: string;
}) {
  await prisma.auditLog
    .create({
      data: { tenantId: o.tenantId, actorId: o.actorId ?? null, action: o.action, entityType: o.entityType, entityId: o.entityId, metadataJson: { userId: o.userId, text: o.text } },
    })
    // the decision itself already happened; a missing log line must not undo it
    .catch((e) => console.error("Audit-Log fehlgeschlagen:", e));
}
