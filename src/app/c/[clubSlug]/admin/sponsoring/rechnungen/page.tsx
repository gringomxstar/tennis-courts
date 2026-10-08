import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { currentSponsorYear } from "@/lib/sponsor-server";
import { parseAddress } from "@/lib/sponsoring";
import { SponsorNav } from "@/components/app/admin-sponsoring";
import { SponsorInvoices } from "@/components/app/sponsor-invoices";

export default async function SponsorInvoicesPage({ params, searchParams }: { params: Promise<{ clubSlug: string }>; searchParams: Promise<{ jahr?: string }> }) {
  const [{ clubSlug }, { jahr }] = await Promise.all([params, searchParams]);
  const { tenant } = await requireTenantAdmin(clubSlug);
  const year = Number(jahr) || (await currentSponsorYear(tenant.id));
  const now = new Date();
  const invoices = await prisma.sponsorInvoice.findMany({
    where: { tenantId: tenant.id, year },
    include: { sponsor: { select: { id: true, name: true, token: true } } },
    orderBy: { number: "desc" },
  });
  return (
    <>
      <div className="px-5 pt-3 @min-[640px]:pt-0">
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Rechnungen</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">QR-Rechnungen, Zahlungsstatus, Mahnungen</div>
      </div>
      <SponsorNav slug={tenant.slug} active="rechnungen" year={year} />
      <SponsorInvoices
        slug={tenant.slug}
        year={year}
        sample={!tenant.settingsJson?.invoiceIban || !parseAddress(tenant.address)}
        invoices={invoices.map((i) => ({
          id: i.id, number: i.number, sponsorId: i.sponsor.id, sponsor: i.sponsor.name, token: i.sponsor.token, amount: Number(i.amount),
          issuedAt: i.issuedAt.toISOString(), dueAt: i.dueAt.toISOString(), paidAt: i.paidAt?.toISOString() ?? "", dunningLevel: i.dunningLevel, sentAt: i.sentAt?.toISOString() ?? "", overdue: !i.paidAt && i.dueAt < now,
        }))}
      />
    </>
  );
}
