import type { Metadata } from "next";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { TabBar } from "@/components/app/tab-bar";
import { DemoSwitcher } from "@/components/app/demo-switcher";
import { initials } from "@/lib/courts";
import { DEMO_ACCOUNTS, demoModeOn, isDemoEmail } from "@/lib/demo";

const DEMO_PERSONAS = [
  { email: null, label: "Gast", name: "Nicht angemeldet" },
  ...Object.entries(DEMO_ACCOUNTS).map(([email, p]) => ({ email, label: p.label, name: `${p.firstName} ${p.lastName}` })),
];

// Tab title, favicon, iOS home-screen icon and manifest follow the club's branding (see ./icon and ./manifest.webmanifest).
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug: clubSlug }, select: { name: true } });
  if (!t) return {};
  return {
    title: t.name,
    description: `Plätze bei ${t.name} reservieren`,
    manifest: `/c/${clubSlug}/manifest.webmanifest`,
    icons: { icon: `/c/${clubSlug}/icon?s=64`, apple: `/c/${clubSlug}/icon?s=180` },
    appleWebApp: { capable: true, title: t.name, statusBarStyle: "black-translucent" },
  };
}

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const ctx = await getTenantContext(clubSlug);
  const { tenant, user } = ctx;
  const brand = tenant.settingsJson?.brandColor;
  return (
    <div className="@container min-h-[100dvh] bg-background text-foreground">
      {/* validated #rrggbb in updateClubBrandingAction; the shades derive from it in globals.css */}
      {brand && /^#[0-9a-f]{6}$/i.test(brand) && <style>{`:root{--tennis-clay:${brand}}`}</style>}
      <TabBar slug={tenant.slug} clubName={tenant.name} logoUrl={tenant.logoUrl} anon={!user} canAdmin={ctx.isTenantAdmin} ini={user ? initials(user.name || user.email) : undefined}>
        {children}
      </TabBar>
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
