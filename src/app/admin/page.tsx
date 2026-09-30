import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/tenant";
import { getAllTenants, getCourtsByTenantId } from "@/lib/data";
import { logoutAction } from "@/app/actions/auth";
import { Chevron } from "@/components/app/avatar";

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();
  const tenants = await getAllTenants();

  const tenantStats = await Promise.all(
    tenants.map(async (t) => {
      const courts = await getCourtsByTenantId(t.id);
      return {
        tenant: t,
        courtsCount: courts.length,
      };
    })
  );
  const totalCourts = tenantStats.reduce((acc, curr) => acc + curr.courtsCount, 0);

  return (
    <div className="@container min-h-[100dvh] bg-background text-foreground">
      <main className="mx-auto w-full max-w-[640px] px-5 pb-16 pt-[66px] @min-[640px]:pt-8 @min-[1024px]:max-w-[1280px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-.03em]">Plattform</h1>
            <div className="mt-0.5 text-[15px] text-muted-foreground">
              {tenants.length} {tenants.length === 1 ? "Club" : "Clubs"} · {totalCourts} Plätze · Mandantenverwaltung
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="mt-2.5 text-[15px] font-bold text-clay-text">
              Abmelden
            </button>
          </form>
        </div>

        <div className="pb-2.5 pt-6 text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground">
          Aktive Clubs
        </div>
        <div className="grid grid-cols-1 gap-3 @min-[640px]:gap-4 @min-[1024px]:grid-cols-2 @min-[1280px]:grid-cols-3">
          {tenantStats.map(({ tenant, courtsCount }) => (
            <div key={tenant.id} className="flex flex-col card p-5">
              <div className="text-[20px] font-bold tracking-[-.02em]">{tenant.name}</div>
              <div className="mt-0.5 text-[14px] text-muted-foreground">
                {tenant.address || "Keine Adresse"} · {courtsCount} Plätze
              </div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">
                /c/{tenant.slug} · {tenant.timezone}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={`/c/${tenant.slug}`}
                  className="flex items-center justify-between btn btn-ghost !h-11 justify-between"
                >
                  Buchungskalender
                  <Chevron />
                </Link>
                <Link
                  href={`/c/${tenant.slug}/admin`}
                  className="flex items-center justify-between btn btn-ghost !h-11 justify-between"
                >
                  Club-Admin
                  <Chevron />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
