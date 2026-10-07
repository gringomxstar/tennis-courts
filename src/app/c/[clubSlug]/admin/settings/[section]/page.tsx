import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantAdmin } from "@/lib/tenant";
import { getCourtsByTenantId, getMembershipPlansByTenantId } from "@/lib/data";
import { ClubSettingsForm, type SettingsSection } from "@/components/admin/club-settings-form";
import { CourtsManager } from "@/components/admin/courts-manager";
import { BrandingForm } from "@/components/admin/branding-form";
import { MembershipPlansManager } from "@/components/admin/membership-plans-manager";

const TITLES: Record<string, [string, string]> = {
  plaetze: ["Plätze", "Plätze anlegen, Preis pro Stunde, Wartung."],
  oeffnung: ["Öffnungszeiten", "Ab wann und bis wann gebucht werden kann."],
  abos: ["Abos", "Was Mitglieder bezahlen und wie viel sie buchen dürfen."],
  regeln: ["Buchungsregeln", "Stornieren, Fairplay und wie viele Buchungen gleichzeitig."],
  preise: ["Preise & Rabatte", "Rabatte und Zuschläge, Gebühren und Standardpreise."],
  zahlungen: ["Zahlungen & Rechnungen", "Wie Spieler bezahlen und die Daten für den QR-Einzahlungsschein."],
  aussehen: ["Aussehen", "Name, Farbe und Logo des Clubs."],
  gaeste: ["Gäste & Demo", "Gastbuchungen, Diner Tennis und Test-Modus."],
};

export default async function SettingsSectionPage({ params }: { params: Promise<{ clubSlug: string; section: string }> }) {
  const { clubSlug, section } = await params;
  const meta = TITLES[section];
  if (!meta) notFound();
  const { tenant } = await requireTenantAdmin(clubSlug);

  let body: React.ReactNode;
  if (section === "plaetze") body = <CourtsManager clubSlug={tenant.slug} courts={await getCourtsByTenantId(tenant.id)} />;
  else if (section === "abos") body = <MembershipPlansManager clubSlug={tenant.slug} initialPlans={await getMembershipPlansByTenantId(tenant.id)} />;
  else if (section === "aussehen")
    body = <BrandingForm clubSlug={tenant.slug} clubName={tenant.name} color={tenant.settingsJson?.brandColor} logo={tenant.logoUrl} bookingColors={tenant.settingsJson?.bookingColors} />;
  else body = <ClubSettingsForm clubSlug={tenant.slug} initialSettings={tenant.settingsJson} initialAddress={tenant.address} section={section as SettingsSection} />;

  return (
    <>
      <div className="px-5 pt-3 @min-[640px]:px-0 @min-[640px]:pt-0">
        <Link href={`/c/${tenant.slug}/admin/settings`} className="inline-flex items-center gap-1 text-[15px] font-semibold text-clay-text @min-[1024px]:hidden"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Einstellungen</Link>
        <h1 className="text-[28px] font-bold tracking-[-.03em]">{meta[0]}</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">{meta[1]}</div>
      </div>
      <div className="max-w-[720px] px-5 pb-8 pt-4 @min-[640px]:px-0">{body}</div>
    </>
  );
}
