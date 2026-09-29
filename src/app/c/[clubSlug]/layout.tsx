import { getTenantContext } from "@/lib/tenant";
import { TabBar } from "@/components/app/tab-bar";
import { DemoSwitcher } from "@/components/app/demo-switcher";
import { DEMO_ACCOUNTS, demoModeOn, isDemoEmail } from "@/lib/demo";

const DEMO_PERSONAS = [
  { email: null, label: "Gast", name: "Nicht angemeldet" },
  ...Object.entries(DEMO_ACCOUNTS).map(([email, p]) => ({ email, label: p.label, name: `${p.firstName} ${p.lastName}` })),
];

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const { tenant, user } = await getTenantContext(clubSlug);
  const brand = tenant.settingsJson?.brandColor;
  return (
    <div className="min-h-[100dvh] bg-background text-foreground lg:pl-64">
      {/* validated #rrggbb in updateClubBrandingAction; the shades derive from it in globals.css */}
      {brand && /^#[0-9a-f]{6}$/i.test(brand) && <style>{`:root{--tennis-clay:${brand}}`}</style>}
      <main className="mx-auto w-full max-w-[640px] pb-[calc(max(10px,env(safe-area-inset-bottom))+88px)] lg:max-w-[1280px] lg:px-6 lg:pb-16">{children}</main>
      <TabBar slug={tenant.slug} clubName={tenant.name} logoUrl={tenant.logoUrl} anon={!user} />
      {demoModeOn(tenant.settingsJson) && (
        <DemoSwitcher
          slug={tenant.slug}
          personas={DEMO_PERSONAS}
          current={!user ? null : isDemoEmail(user.email) ? user.email : "other"}
        />
      )}
    </div>
  );
}
