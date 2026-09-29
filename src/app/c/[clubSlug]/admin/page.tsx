import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function AdminHubPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const n = process.env.DATABASE_URL ? await prisma.tenantUser.count({ where: { tenantId: tenant.id } }) : 0;
  const rows = [
    ["today", "Heute", "Belegung und Sperren heute"],
    ["members", "Mitglieder", `${n} Mitglieder`],
    ["blocks", "Sperren", "Plätze sperren, geplante Sperren"],
    ["stats", "Statistik", "Auslastung, Umsatz, CSV-Export"],
    ["settings", "Einstellungen", "Öffnungszeiten, Storno, Preise, Plätze, Abos, Farbe & Logo"],
  ];
  return (
    <>
      <div className="px-5 pt-[66px] lg:pt-12">
        <h1 className="text-[26px] font-bold tracking-[-.03em]">Verwaltung</h1>
      </div>
      <nav aria-label="Verwaltung" className="mx-5 mt-4 overflow-hidden rounded-[22px] border border-border bg-card lg:max-w-md">
        {rows.map(([href, title, sub]) => (
          <Link key={href} href={`/c/${tenant.slug}/admin/${href}`} className="flex items-center gap-3 border-t border-border px-[18px] py-3.5 first:border-t-0">
            <span className="flex-1">
              <span className="block text-[16px] font-bold">{title}</span>
              <span className="block text-[13px] text-muted-foreground">{sub}</span>
            </span>
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="m9 18 6-6-6-6" /></svg>
          </Link>
        ))}
      </nav>
    </>
  );
}
