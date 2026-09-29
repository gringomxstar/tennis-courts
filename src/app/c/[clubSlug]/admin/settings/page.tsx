import { requireTenantAdmin } from "@/lib/tenant";
import {
  getCourtsByTenantId,
  getTenantMembers,
  getMembershipPlansByTenantId,
} from "@/lib/data";
import { ClubSettingsForm } from "@/components/admin/club-settings-form";
import { MembershipPlansManager } from "@/components/admin/membership-plans-manager";
import { slotLimitFor } from "@/lib/booking-rules";

const card = "rounded-[26px] border border-border bg-card p-5";
const label = "text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const h2 = "text-[22px] font-bold tracking-[-.02em]";
const sub = "mt-1 text-[15px] leading-[1.4] text-muted-foreground";
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
        <h1 className="text-[34px] font-bold tracking-[-.035em]">Club-Einstellungen</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">{tenant.name}</div>
      </div>

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
              <div className="text-[28px] font-bold leading-none tracking-[-.03em]">{members.length}</div>
            </div>
            <div className="mt-3 text-[14px] leading-[1.6] text-muted-foreground">
              <div>{members.filter((m) => m.role === "CLUB_ADMIN").length} Administratoren</div>
              <div>{members.filter((m) => m.role === "MEMBER").length} Aktive Clubmitglieder</div>
              <div>{membershipPlans.length} Tarife</div>
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
          <ClubSettingsForm clubSlug={tenant.slug} initialSettings={tenant.settingsJson} />

          <section className={card}>
            <h2 className={h2}>Plätze ({courts.length})</h2>
            <p className={sub}>Alle bespielbaren Tennis- und Padel-Plätze mit Stundensätzen.</p>
            <div className="mt-5 overflow-hidden rounded-[22px] border border-border">
              {courts.map((court) => (
                <div key={court.id} className="flex items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-bold">
                      {court.name}
                      <span className="ml-2 text-[13px] font-semibold text-muted-foreground">
                        {court.sportType === "PADEL" ? "Padel" : "Tennis"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted-foreground">
                      {court.surface === "CLAY" ? "Sandplatz" : court.surface === "CARPET" ? "Teppich" : "Hartplatz"}
                      {" · "}
                      {court.isIndoor ? "Halle" : "Outdoor"}
                      {court.hasLighting && " · Flutlicht"}
                      {" · "}
                      <span className="font-semibold text-foreground">{court.hourlyRate} CHF/h</span>
                    </div>
                  </div>
                  <span
                    className={`${pill} ${court.status === "ACTIVE" ? "bg-paid-bg text-paid-fg" : "bg-clay text-white"}`}
                  >
                    {court.status === "ACTIVE" ? "Bespielbar" : "Wartung"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <MembershipPlansManager clubSlug={tenant.slug} initialPlans={membershipPlans} />
      </div>
    </>
  );
}
