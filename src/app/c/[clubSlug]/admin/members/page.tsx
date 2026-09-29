import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { getMembershipPlansByTenantId, getTenantMembers } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { AdminMembers, ImportMembers, type MemberRow } from "@/components/app/admin-members";

const RANK = { ACTIVE: 0, PENDING: 1, EXPIRED: 2, CANCELLED: 3 } as const;

export default async function AdminMembersPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const [members, plans] = await Promise.all([getTenantMembers(tenant.id), getMembershipPlansByTenantId(tenant.id)]);

  // Memberships are Postgres/Stripe-only (see api/checkout/route.ts), no mockDb equivalent,
  // so this queries Prisma directly, same as the invoice lookup on the old admin page.
  const best = new Map<string, {
    status: keyof typeof RANK; planName: string; planId: string; stripeCustomerId: string | null;
    startsAt: Date; endsAt: Date | null; paidAt: Date | null; pricePaid: number | null;
  }>();
  const profile = new Map<string, { birthDate: string; gender: string }>();
  const renewal = new Map<string, { endsAt: Date | null; status: string }>();
  const history = new Map<string, { at: string; text: string; by: string }[]>();
  if (process.env.DATABASE_URL) {
    const now = new Date();
    const memberships = await prisma.membership.findMany({
      where: { tenantId: tenant.id },
      include: { user: true, plan: true },
      orderBy: { startsAt: "desc" },
    });
    for (const m of memberships) {
      const cur = best.get(m.userId);
      // same status: prefer the running Abo over an already renewed next season
      const running = cur && RANK[m.status] === RANK[cur.status] && cur.startsAt > now && m.startsAt <= now;
      if (!cur || RANK[m.status] < RANK[cur.status] || running) {
        best.set(m.userId, {
          status: m.status, planName: m.plan.name, planId: m.plan.id, stripeCustomerId: m.user.stripeCustomerId,
          startsAt: m.startsAt, endsAt: m.endsAt, paidAt: m.paidAt, pricePaid: m.pricePaid == null ? null : Number(m.pricePaid),
        });
      }
    }
    // next season already booked (renewed Abo starts when the current one ends)
    for (const m of memberships) {
      const cur = best.get(m.userId);
      if (cur?.endsAt && (m.status === "ACTIVE" || m.status === "PENDING") && m.startsAt >= cur.endsAt) {
        renewal.set(m.userId, { endsAt: m.endsAt, status: m.status });
      }
    }
  }

  if (process.env.DATABASE_URL) {
    // manual money decisions (logMoney): paid by hand, waived, Abo assigned/imported/renewed/ended
    const logs = await prisma.auditLog.findMany({
      where: { tenantId: tenant.id, action: { in: ["BOOKING_PAID_MANUAL", "BOOKING_WAIVED", "ABO_PAID_MANUAL", "ABO_INVOICE", "ABO_IMPORTED", "ABO_ENDED"] } },
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    for (const l of logs) {
      const meta = l.metadataJson as { userId?: string; text?: string } | null;
      if (!meta?.userId || !meta.text) continue;
      const list = history.get(meta.userId) ?? [];
      if (list.length < 20) list.push({ at: l.createdAt.toISOString(), text: meta.text, by: l.actor ? `${l.actor.firstName} ${l.actor.lastName}`.trim() : "System" });
      history.set(meta.userId, list);
    }
  }

  if (process.env.DATABASE_URL) {
    const users = await prisma.user.findMany({
      where: { tenantUsers: { some: { tenantId: tenant.id } } },
      select: { id: true, birthDate: true, gender: true },
    });
    for (const u of users) profile.set(u.id, { birthDate: u.birthDate?.toISOString().slice(0, 10) ?? "", gender: u.gender ?? "" });
  }

  const rows: MemberRow[] = members
    // guest checkouts create GUEST users; keep them only if they bought a membership
    .filter((m) => m.role !== "PLATFORM_ADMIN" && (m.role !== "GUEST" || best.has(m.id)))
    .map((m) => {
      const ms = best.get(m.id);
      return {
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        plan: ms?.planName ?? "Keine Mitgliedschaft",
        state: ms?.status === "ACTIVE" ? "paid" : ms?.status === "PENDING" ? "invoice" : "remind",
        stripeCustomerId: ms?.status === "PENDING" ? ms.stripeCustomerId : null,
        role: m.role,
        phone: m.phone ?? "",
        birthDate: profile.get(m.id)?.birthDate ?? "",
        gender: profile.get(m.id)?.gender ?? "",
        planId: ms && (ms.status === "ACTIVE" || ms.status === "PENDING") ? ms.planId : "",
        planStatus: ms?.status ?? null,
        planStart: ms?.startsAt.toISOString() ?? "",
        planEnd: ms?.endsAt?.toISOString() ?? "",
        paidAt: ms?.paidAt?.toISOString() ?? "",
        pricePaid: ms?.pricePaid ?? null,
        renewedUntil: renewal.get(m.id)?.endsAt?.toISOString() ?? "",
        renewalOpen: renewal.get(m.id)?.status === "PENDING",
        history: history.get(m.id) ?? [],
      };
    });

  return (
    <>
      <div className="flex items-end justify-between gap-3 px-5 pt-[66px] lg:pt-12">
        <div>
          <Link href={`/c/${tenant.slug}/admin`} className="lg:hidden inline-flex items-center gap-1 text-[15px] font-semibold text-clay-text"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Verwaltung</Link>
          <h1 className="text-[34px] font-bold tracking-[-.035em]">Mitglieder</h1>
          <div className="mt-0.5 text-[15px] text-muted-foreground">Abos & Zahlungen</div>
        </div>
        <ImportMembers slug={tenant.slug} />
      </div>
      <AdminMembers slug={tenant.slug} tenantId={tenant.id} members={rows} plans={plans.map((p) => ({ id: p.id, name: p.name, price: p.price, ageMin: p.ageMin ?? null, ageMax: p.ageMax ?? null, proofRequired: Boolean(p.proofRequired) }))} />
    </>
  );
}
