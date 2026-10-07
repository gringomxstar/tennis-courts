import { requireTenantAdmin } from "@/lib/tenant";
import { SettingsList } from "@/components/admin/settings-list";
import { settingsOverview } from "./overview";

export default async function ClubSettingsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const o = await settingsOverview(tenant);
  return (
    <>
      <div className="px-5 pt-3 @min-[640px]:px-0 @min-[640px]:pt-0">
        <h1 className="text-[28px] font-bold tracking-[-.03em]">Einstellungen</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">{tenant.name}</div>
      </div>
      {/* desktop shows the same list in the left column (layout) */}
      <div className="max-w-[720px] px-5 pb-8 pt-4 @min-[640px]:px-0 @min-[1024px]:hidden">
        <SettingsList {...o} />
      </div>
      <p className="hidden pt-4 text-[15px] text-ink-3 @min-[1024px]:block">Links ein Thema wählen.</p>
    </>
  );
}
