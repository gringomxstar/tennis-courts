import { requireTenantAdmin } from "@/lib/tenant";
import { SettingsList } from "@/components/admin/settings-list";
import { settingsOverview } from "./overview";

/** Desktop: topics stay in a left column while the form changes on the right. Phone: pages as before. */
export default async function SettingsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  return (
    <div className="@min-[1024px]:grid @min-[1024px]:grid-cols-[320px_minmax(0,1fr)] @min-[1024px]:items-start @min-[1024px]:gap-5">
      <aside className="sticky top-4 hidden max-h-[calc(100dvh-32px)] overflow-y-auto pb-4 @min-[1024px]:block">
        <SettingsList {...await settingsOverview(tenant)} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
