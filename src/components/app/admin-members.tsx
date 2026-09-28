"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/app/avatar";
import { markInvoiceAsPaidManually, sendPaymentReminderAction } from "@/actions/admin-billing";
import { setMemberRoleAction } from "@/app/actions/club-settings";
import type { TenantRole } from "@/types";
import { initials } from "@/lib/courts";
import { cn } from "@/lib/utils";

export interface MemberRow {
  id: string;
  name: string;
  plan: string;
  /** paid = ACTIVE membership, invoice = PENDING offline invoice, remind = anything else */
  state: "paid" | "invoice" | "remind";
  stripeCustomerId: string | null;
  role: TenantRole;
}

const ROLES: [TenantRole, string][] = [
  ["MEMBER", "Mitglied"],
  ["COACH", "Trainer"],
  ["GUEST", "Gast"],
  ["CLUB_ADMIN", "Admin"],
];

const pill = "rounded-full px-3.5 py-2 text-[13px] font-bold";

export function AdminMembers({ slug, tenantId, members }: { slug: string; tenantId: string; members: MemberRow[] }) {
  const router = useRouter();
  const [reminded, setReminded] = useState<string[]>([]);
  const [paid, setPaid] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function markPaid(m: MemberRow) {
    if (!m.stripeCustomerId || busy) return;
    setBusy(m.id);
    const res = await markInvoiceAsPaidManually(tenantId, m.id, m.stripeCustomerId);
    setBusy(null);
    if (!res.success) {
      toast.error(res.error || "Rechnung konnte nicht als bezahlt markiert werden.");
      return;
    }
    setPaid((p) => [...p, m.id]);
    router.refresh();
  }

  async function setRole(m: MemberRow, role: TenantRole) {
    const res = await setMemberRoleAction(slug, m.id, role);
    toast(res.success ? `${m.name}: ${ROLES.find(([r]) => r === role)?.[1]}` : (res.error ?? "Rolle nicht geändert"));
    router.refresh();
  }

  async function remind(m: MemberRow) {
    if (busy) return;
    setBusy(m.id);
    const res = await sendPaymentReminderAction(tenantId, m.id);
    setBusy(null);
    if (!res.success) {
      toast.error(res.error || "Erinnerung konnte nicht gesendet werden.");
      return;
    }
    setReminded((r) => [...r, m.id]);
    toast("Zahlungserinnerung gesendet");
  }

  return (
    <div className="flex flex-col gap-2.5 px-5 pt-4 lg:grid lg:grid-cols-2">
      {members.map((m) => {
        const isPaid = m.state === "paid" || paid.includes(m.id);
        const sent = reminded.includes(m.id);
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5">
            <Avatar ini={initials(m.name)} />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold">{m.name}</div>
              <div className="text-[14px] text-muted-foreground">{m.plan}</div>
              {m.role !== "PLATFORM_ADMIN" && (
                <select
                  aria-label={`Rolle von ${m.name}`}
                  value={m.role}
                  onChange={(e) => setRole(m, e.target.value as TenantRole)}
                  className="mt-1.5 h-8 rounded-full border border-border bg-inset px-3 text-[13px] font-bold text-foreground outline-none"
                >
                  {ROLES.map(([r, l]) => (
                    <option key={r} value={r}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {isPaid ? (
              <span className={cn(pill, "bg-paid-bg text-paid-fg")}>Bezahlt</span>
            ) : m.state === "invoice" ? (
              <button
                type="button"
                onClick={() => markPaid(m)}
                disabled={busy === m.id}
                aria-label={`Rechnung von ${m.name} als bezahlt markieren`}
                className={cn(pill, "bg-clay text-white")}
              >
                Bezahlt markieren
              </button>
            ) : sent ? (
              <span className={cn(pill, "bg-inset text-muted-foreground")}>Gesendet</span>
            ) : (
              <button
                type="button"
                onClick={() => remind(m)}
                disabled={busy === m.id}
                aria-label={`Zahlungserinnerung an ${m.name} senden`}
                className={cn(pill, "bg-clay text-white")}
              >
                Erinnern
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
