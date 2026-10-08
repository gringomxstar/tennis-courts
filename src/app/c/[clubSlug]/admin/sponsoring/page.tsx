import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { parseAddress } from "@/lib/sponsoring";
import { prisma } from "@/lib/prisma";
import { confirmedLines, contractAmount, contractEnd, followUpDue, hasYear, renewalRate, DAY } from "@/lib/sponsoring";
import { currentSponsorYear, mainContact } from "@/lib/sponsor-server";
import { AdminSponsoring, type SponsorRow } from "@/components/app/admin-sponsoring";

export default async function AdminSponsoringPage({ params, searchParams }: { params: Promise<{ clubSlug: string }>; searchParams: Promise<{ jahr?: string }> }) {
  const [{ clubSlug }, { jahr }] = await Promise.all([params, searchParams]);
  const { tenant, user } = await requireTenantAdmin(clubSlug);
  const year = Number(jahr) || (await currentSponsorYear(tenant.id));

  const [sponsors, campaign, board, tasks, items] = await Promise.all([
    prisma.sponsor.findMany({
      where: { tenantId: tenant.id },
      include: {
        contacts: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
        contracts: { where: { cancelledAt: null }, include: { lines: true } },
        requests: { where: { year } },
        invoices: { where: { OR: [{ year }, { paidAt: null }] } },
        noteList: { select: { text: true, createdAt: true, followUpAt: true, followUpDoneAt: true }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.sponsorCampaign.findUnique({ where: { tenantId_year: { tenantId: tenant.id, year } } }),
    prisma.tenantUser.findMany({ where: { tenantId: tenant.id, role: { in: ["CLUB_ADMIN", "COURT_MANAGER", "COACH"] } }, include: { user: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.sponsorTask.findMany({ where: { doneAt: null, sponsor: { tenantId: tenant.id } }, include: { sponsor: { select: { id: true, name: true } }, assignee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.sponsorItem.findMany({ where: { tenantId: tenant.id, active: true }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  const now = new Date();
  const prevSet = new Set<string>(), curSet = new Set<string>();
  const rows: SponsorRow[] = sponsors.map((s) => {
    const cur = s.contracts.find((c) => hasYear(c, year));
    if (cur) curSet.add(s.id);
    if (s.contracts.some((c) => hasYear(c, year - 1))) prevSet.add(s.id);
    const req = s.requests[0];
    const contact = s.contacts.find((c) => c.isPrimary) ?? s.contacts[0];
    const mail = mainContact(s);
    const open = s.noteList.filter((n) => n.followUpAt && !n.followUpDoneAt);
    const fu = open.map((n) => n.followUpAt!).sort((a, b) => +a - +b)[0] ?? null;
    const last = s.noteList[0];
    const end = cur ? contractEnd(cur) : null;
    const inv = s.invoices.filter((i) => i.year === year);
    return {
      id: s.id,
      name: s.name,
      contact: contact?.name ?? "",
      hasEmail: Boolean(mail),
      email: mail?.email ?? "",
      phone: contact?.phone ?? "",
      updatedAt: s.updatedAt.toISOString(),
      lastNote: last ? { text: last.text, at: last.createdAt.toISOString() } : null,
      firstName: mail?.name.trim().split(/\s+/)[0] ?? "",
      city: s.city ?? "",
      stage: s.stage,
      followUp: fu?.toISOString() ?? null,
      due: open.some((n) => followUpDue(n, now)),
      endsInDays: end ? Math.ceil((end.getTime() - now.getTime()) / DAY) : null,
      endYear: end ? end.getUTCFullYear() : null,
      dunning: Math.max(0, ...s.invoices.filter((i) => !i.paidAt).map((i) => i.dunningLevel)),
      itemIds: [...new Set(s.contracts.flatMap((c) => confirmedLines(c, year).map((l) => l.itemId)))],
      ownerId: s.owner?.id ?? "",
      owner: s.owner ? `${s.owner.firstName} ${s.owner.lastName}`.trim() : "",
      status: cur ? "CONFIRMED" : req?.status ?? "NONE",
      queued: Boolean(req && !req.sentAt && !cur),
      amount: cur ? contractAmount(cur, year) : 0,
      runningUntil: cur && cur.years > 1 ? cur.startYear + cur.years - 1 : null,
      billed: inv.reduce((a, i) => a + Number(i.amount), 0),
      paid: inv.filter((i) => i.paidAt).reduce((a, i) => a + Number(i.amount), 0),
    };
  });
  const sum = (k: "amount" | "billed" | "paid") => rows.reduce((a, r) => a + r[k], 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-3 @min-[640px]:pt-0">
        <div>
          <h1 className="text-[34px] font-bold tracking-[-.035em]">Sponsoring</h1>
          <div className="mt-0.5 text-[15px] text-muted-foreground">{sponsors.length} Sponsoren · Saison {year}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/c/${tenant.slug}/admin/sponsoring/statistik?jahr=${year}`} className="inline-flex min-h-10 items-center rounded-full bg-card px-3.5 text-[13px] font-bold shadow-card">Statistik</Link>
          <a href={`/c/${tenant.slug}/admin/sponsoring/export`} download aria-label="Sponsoren exportieren (CSV)" className="inline-flex size-10 items-center justify-center rounded-full bg-card shadow-card">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          </a>
        </div>
      </div>
      <AdminSponsoring
        sample={!tenant.settingsJson?.invoiceIban || !parseAddress(tenant.address)}
        slug={tenant.slug}
        year={year}
        meId={user?.id ?? ""}
        rows={rows}
        items={items}
        totals={{ committed: sum("amount"), billed: sum("billed"), paid: sum("paid"), renewal: renewalRate(prevSet, curSet), prevCount: prevSet.size }}
        campaign={campaign ? { startedAt: campaign.startedAt.toISOString(), reminderDays: campaign.reminderDays, taskDays: campaign.taskDays } : null}
        board={board.map((b) => ({ id: b.user.id, name: `${b.user.firstName} ${b.user.lastName}`.trim() }))}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title, sponsorId: t.sponsor.id, sponsor: t.sponsor.name, assigneeId: t.assignee?.id ?? "", assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "", createdAt: t.createdAt.toISOString() }))}
      />
    </>
  );
}
