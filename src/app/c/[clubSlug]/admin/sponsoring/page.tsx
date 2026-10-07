import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { contractAmount, hasYear, renewalRate } from "@/lib/sponsoring";
import { currentSponsorYear } from "@/lib/sponsor-server";
import { AdminSponsoring, type SponsorRow } from "@/components/app/admin-sponsoring";

export default async function AdminSponsoringPage({ params, searchParams }: { params: Promise<{ clubSlug: string }>; searchParams: Promise<{ jahr?: string }> }) {
  const [{ clubSlug }, { jahr }] = await Promise.all([params, searchParams]);
  const { tenant, user } = await requireTenantAdmin(clubSlug);
  const year = Number(jahr) || (await currentSponsorYear(tenant.id));

  const [sponsors, campaign, board, tasks] = await Promise.all([
    prisma.sponsor.findMany({
      where: { tenantId: tenant.id },
      include: {
        contacts: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
        contracts: { where: { cancelledAt: null }, include: { lines: true } },
        requests: { where: { year } },
        invoices: { where: { year } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.sponsorCampaign.findUnique({ where: { tenantId_year: { tenantId: tenant.id, year } } }),
    prisma.tenantUser.findMany({ where: { tenantId: tenant.id, role: { in: ["CLUB_ADMIN", "COURT_MANAGER", "COACH"] } }, include: { user: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.sponsorTask.findMany({ where: { doneAt: null, sponsor: { tenantId: tenant.id } }, include: { sponsor: { select: { id: true, name: true } }, assignee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }),
  ]);

  const prevSet = new Set<string>(), curSet = new Set<string>();
  const rows: SponsorRow[] = sponsors.map((s) => {
    const cur = s.contracts.find((c) => hasYear(c, year));
    if (cur) curSet.add(s.id);
    if (s.contracts.some((c) => hasYear(c, year - 1))) prevSet.add(s.id);
    const req = s.requests[0];
    const contact = s.contacts.find((c) => c.isPrimary) ?? s.contacts[0];
    return {
      id: s.id,
      name: s.name,
      contact: contact?.name ?? "",
      hasEmail: s.contacts.some((c) => c.email),
      ownerId: s.owner?.id ?? "",
      owner: s.owner ? `${s.owner.firstName} ${s.owner.lastName}`.trim() : "",
      status: cur ? "CONFIRMED" : req?.status ?? "NONE",
      queued: Boolean(req && !req.sentAt && !cur),
      amount: cur ? contractAmount(cur, year) : 0,
      runningUntil: cur && cur.years > 1 ? cur.startYear + cur.years - 1 : null,
      billed: s.invoices.reduce((a, i) => a + Number(i.amount), 0),
      paid: s.invoices.filter((i) => i.paidAt).reduce((a, i) => a + Number(i.amount), 0),
    };
  });
  const sum = (k: "amount" | "billed" | "paid") => rows.reduce((a, r) => a + r[k], 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-[66px] lg:pt-12">
        <div>
          <Link href={`/c/${tenant.slug}/admin`} className="lg:hidden inline-flex items-center gap-1 text-[15px] font-semibold text-clay-text"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Verwaltung</Link>
          <h1 className="text-[34px] font-bold tracking-[-.035em]">Sponsoring</h1>
          <div className="mt-0.5 text-[15px] text-muted-foreground">{sponsors.length} Sponsoren · Saison {year}</div>
        </div>
      </div>
      <AdminSponsoring
        slug={tenant.slug}
        year={year}
        meId={user?.id ?? ""}
        rows={rows}
        totals={{ committed: sum("amount"), billed: sum("billed"), paid: sum("paid"), renewal: renewalRate(prevSet, curSet), prevCount: prevSet.size }}
        campaign={campaign ? { startedAt: campaign.startedAt.toISOString(), reminderDays: campaign.reminderDays, taskDays: campaign.taskDays } : null}
        board={board.map((b) => ({ id: b.user.id, name: `${b.user.firstName} ${b.user.lastName}`.trim() }))}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title, sponsorId: t.sponsor.id, sponsor: t.sponsor.name, assigneeId: t.assignee?.id ?? "", assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "", createdAt: t.createdAt.toISOString() }))}
      />
    </>
  );
}
