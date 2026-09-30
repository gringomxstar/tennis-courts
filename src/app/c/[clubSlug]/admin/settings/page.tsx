import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { getCourtsByTenantId, getMembershipPlansByTenantId } from "@/lib/data";
import { ClubSettingsForm } from "@/components/admin/club-settings-form";
import { CourtsManager } from "@/components/admin/courts-manager";
import { BrandingForm } from "@/components/admin/branding-form";
import { MembershipPlansManager } from "@/components/admin/membership-plans-manager";

interface ClubSettingsPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
}

export default async function ClubSettingsPage({ params }: ClubSettingsPageProps) {
  const { clubSlug } = await params;
  const context = await requireTenantAdmin(clubSlug);
  const tenant = context.tenant;

  const [courts, membershipPlans] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getMembershipPlansByTenantId(tenant.id),
  ]);

  return (
    <>
      <div className="px-5 pt-[66px] @min-[640px]:px-0 @min-[640px]:pt-0">
        <Link href={`/c/${tenant.slug}/admin`} className="@min-[640px]:hidden inline-flex items-center gap-1 text-[15px] font-semibold text-clay-text"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Verwaltung</Link>
        <h1 className="text-[28px] font-bold tracking-[-.03em]">Einstellungen</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">{tenant.name}</div>
      </div>
      <nav className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4 @min-[640px]:px-0" aria-label="Abschnitte">
        {[["regeln", "Regeln"], ["plaetze", "Plätze"], ["tarife", "Tarife"], ["branding", "Branding"]].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="chip">
            {l}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-4 px-5 pb-8 pt-4 @min-[640px]:px-0">
        <div className="grid grid-cols-1 gap-4 @min-[1100px]:grid-cols-2 @min-[1100px]:items-start">
          <div id="regeln" className="scroll-mt-4">
            <ClubSettingsForm clubSlug={tenant.slug} initialSettings={tenant.settingsJson} />
          </div>
          <div className="flex flex-col gap-4">
            <div id="plaetze" className="scroll-mt-4">
              <CourtsManager clubSlug={tenant.slug} courts={courts} />
            </div>
            <div id="branding" className="scroll-mt-4">
              <BrandingForm clubSlug={tenant.slug} clubName={tenant.name} color={tenant.settingsJson?.brandColor} logo={tenant.logoUrl} bookingColors={tenant.settingsJson?.bookingColors} />
            </div>
          </div>
        </div>
        <div id="tarife" className="scroll-mt-4">
          <MembershipPlansManager clubSlug={tenant.slug} initialPlans={membershipPlans} />
        </div>
      </div>
    </>
  );
}
