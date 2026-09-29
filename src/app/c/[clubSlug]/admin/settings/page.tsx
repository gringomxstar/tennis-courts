import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import {
  getCourtsByTenantId,
  getTenantMembers,
  getMembershipPlansByTenantId,
} from "@/lib/data";
import { ClubSettingsForm } from "@/components/admin/club-settings-form";
import { CourtsManager } from "@/components/admin/courts-manager";
import { BrandingForm } from "@/components/admin/branding-form";
import { MembershipPlansManager } from "@/components/admin/membership-plans-manager";
import { slotLimitFor } from "@/lib/booking-rules";

const card = "rounded-[26px] border border-border bg-card p-5";
const label = "text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const pill = "shrink-0 rounded-full px-3 py-1 text-[13px] font-bold";

interface ClubSettingsPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
}

export default async function ClubSettingsPage({ params }: ClubSettingsPageProps) {
  const { clubSlug } = await params;
  const context = await requireTenantAdmin(clubSlug);
  const tenant = context.tenant;

  const [courts, members, membershipPlans] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getTenantMembers(tenant.id),
    getMembershipPlansByTenantId(tenant.id),
  ]);

  return (
    <>
      <div className="px-5 pt-[66px] lg:pt-12">
        <Link href={`/c/${tenant.slug}/admin`} className="lg:hidden inline-flex items-center gap-1 text-[15px] font-semibold text-clay-text"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Verwaltung</Link>
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Club-Einstellungen</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">{tenant.name}</div>
      </div>
      <nav className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4" aria-label="Abschnitte">
        {[["regeln", "Buchungsregeln"], ["plaetze", "Plätze"], ["tarife", "Abos & Tarife"], ["branding", "Farbe & Logo"]].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="flex-none rounded-full border border-border px-4 py-2 text-[14px] font-semibold">
            {l}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-4 px-5 pb-8 pt-4 lg:gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-6">
          <div className={card}>
            <div className="flex items-baseline justify-between gap-2">
              <div className={label}>Plätze</div>
              <div className="text-[28px] font-bold leading-none tracking-[-.03em]">{courts.length}</div>
            </div>
            <div className="mt-3 text-[14px] leading-[1.6] text-muted-foreground">
              <div>{courts.filter((c) => c.sportType === "TENNIS").length} Tennisplätze</div>
              <div>{courts.filter((c) => c.sportType === "PADEL").length} Padel Courts</div>
              <div>{courts.filter((c) => c.isIndoor).length} Hallenplätze</div>
            </div>
          </div>

          <div className={card}>
            <div className="flex items-baseline justify-between gap-2">
              <div className={label}>Mitglieder</div>
              <div className="text-[28px] font-bold leading-none tracking-[-.03em]">{members.filter((m) => m.role !== "GUEST" && m.role !== "PLATFORM_ADMIN").length}</div>
            </div>
            <div className="mt-3 text-[14px] leading-[1.6] text-muted-foreground">
              <div>{members.filter((m) => m.role === "MEMBER").length} Mitglieder</div>
              <div>{members.filter((m) => m.role === "COACH").length} Trainer · {members.filter((m) => m.role === "CLUB_ADMIN").length} Admin</div>
              <div>{members.filter((m) => m.role === "GUEST").length} Gastkonten (nicht gezählt)</div>
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center justify-between gap-2">
              <div className={label}>Regeln</div>
              <span
                className={`${pill} ${
                  tenant.settingsJson?.marlyRuleEnabled ? "bg-paid-bg text-paid-fg" : "bg-inset text-muted-foreground"
                }`}
              >
                {tenant.settingsJson?.marlyRuleEnabled ? "Marly Fairplay" : "Standard"}
              </span>
            </div>
            <div className="mt-3 text-[14px] leading-[1.6] text-muted-foreground">
              <div>Zeiten: {tenant.settingsJson?.openingHour || 7}:00 – {tenant.settingsJson?.closingHour || 22}:00 Uhr</div>
              <div>
                Max. Slots Mitglied: {Number.isFinite(slotLimitFor(tenant.settingsJson, "MEMBER", "TENNIS")) ? slotLimitFor(tenant.settingsJson, "MEMBER", "TENNIS") : "unbegrenzt"}
              </div>
              <div>2h Doppel: {tenant.settingsJson?.allowConsecutiveSlotsForDoubles ? "Erlaubt (4 Spieler)" : "Deaktiviert"}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
          <div id="regeln" className="scroll-mt-20">
            <ClubSettingsForm clubSlug={tenant.slug} initialSettings={tenant.settingsJson} />
          </div>

          <div id="plaetze" className="scroll-mt-20">
            <CourtsManager clubSlug={tenant.slug} courts={courts} />
          </div>
        </div>

        <div id="tarife" className="scroll-mt-20">
          <MembershipPlansManager clubSlug={tenant.slug} initialPlans={membershipPlans} />
        </div>
        <div id="branding" className="scroll-mt-20">
          <BrandingForm clubSlug={tenant.slug} clubName={tenant.name} color={tenant.settingsJson?.brandColor} logo={tenant.logoUrl} bookingColors={tenant.settingsJson?.bookingColors} />
        </div>
      </div>
    </>
  );
}
