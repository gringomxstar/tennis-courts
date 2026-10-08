import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

const I = {
  today: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  blocks: "M4.9 4.9l14.2 14.2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  members: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  events: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  stats: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  sponsoring: "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.9 7 23l5-3 5 3-1.2-9.1",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
};

export default async function AdminHubPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  // four cheap counts; "today" is the server's day, close enough for a summary line
  const day = new Date().setHours(0, 0, 0, 0);
  const year = new Date().getFullYear();
  const [members, todays, blocks, unpaid, courts, sponsors, yearBookings, events] = process.env.DATABASE_URL
    ? await Promise.all([
        prisma.tenantUser.count({ where: { tenantId: tenant.id } }),
        prisma.booking.count({ where: { tenantId: tenant.id, status: { in: ["CONFIRMED", "COMPLETED"] }, startsAt: { gte: new Date(day), lt: new Date(day + 86_400_000) } } }),
        prisma.courtBlock.count({ where: { tenantId: tenant.id, endsAt: { gt: new Date() } } }),
        prisma.booking.count({ where: { tenantId: tenant.id, paymentMethod: { in: ["ON_SITE", "INVOICE"] }, paymentStatus: "UNPAID", status: { in: ["CONFIRMED", "COMPLETED"] } } }),
        prisma.court.count({ where: { tenantId: tenant.id, status: "ACTIVE" } }),
        prisma.sponsor.count({ where: { tenantId: tenant.id } }),
        prisma.booking.count({ where: { tenantId: tenant.id, status: { in: ["CONFIRMED", "COMPLETED"] }, startsAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } } }),
        prisma.event.count({ where: { tenantId: tenant.id, cancelledAt: null, endsAt: { gt: new Date() } } }),
      ])
    : [0, 0, 0, 0, 0, 0, 0, 0];
  const tiles: [keyof typeof I, string, string | number, string, boolean?][] = [
    ["today", "Heute", todays, todays === 1 ? "Buchung heute" : "Buchungen heute", true],
    ["blocks", "Sperren", blocks, "aktiv oder geplant"],
    ["members", "Mitglieder", members, "Abos, Zahlungen, Import"],
    ["sponsoring", "Sponsoring", sponsors, "Kampagne, Verträge, Rechnungen"],
    ["events", "Anlässe", events, "kommende, Zu- und Absagen"],
    ["stats", "Statistik", yearBookings, `Buchungen ${year} · Kasse, Export`],
    ["settings", "Einstellungen", courts, "Plätze, Abos, Regeln, Preise"],
  ];
  return (
    <>
      <div className="px-5 pt-3 @min-[640px]:px-0 @min-[640px]:pt-0">
        <h1 className="text-[28px] font-bold tracking-[-.03em]">Verwaltung</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">{tenant.name}</div>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pt-4 @min-[640px]:px-0">
        <Link href={`/c/${tenant.slug}/admin/today`} className="btn">Regen: Plätze sperren ›</Link>
        <Link href={`/c/${tenant.slug}/admin/members?new=1`} className="btn">+ Mitglied</Link>
        {unpaid > 0 && <Link href={`/c/${tenant.slug}/admin/today#zahlungen`} className="btn !bg-warn-bg !text-warn">{unpaid} {unpaid === 1 ? "Zahlung" : "Zahlungen"} offen ›</Link>}
      </div>
      <nav aria-label="Bereiche" className="grid grid-cols-1 gap-3 px-5 pt-4 @min-[640px]:grid-cols-2 @min-[640px]:gap-4 @min-[640px]:px-0 @min-[1024px]:grid-cols-3">
        {tiles.map(([key, title, num, sub, hero]) => (
          <Link
            key={key}
            href={`/c/${tenant.slug}/admin/${key}`}
            className={cn("card flex flex-col gap-1 p-5", hero && "bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_70%)] text-white")}
          >
            <span className={cn("mb-2 flex h-10 w-10 items-center justify-center rounded-full", hero ? "bg-white/20" : "bg-brand-tint text-brand-deep")}>
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={I[key]} /></svg>
            </span>
            <b className="text-[34px] font-bold leading-none tracking-[-.04em] tabular-nums">{num}</b>
            <span className="text-[16px] font-bold">{title}</span>
            <small className={cn("text-[13px]", hero ? "text-white/85" : "text-ink-3")}>{sub}</small>
          </Link>
        ))}
      </nav>
    </>
  );
}
