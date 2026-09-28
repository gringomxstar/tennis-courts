import { getTenantContext } from "@/lib/tenant";
import { TabBar } from "@/components/app/tab-bar";

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const { tenant } = await getTenantContext(clubSlug);
  return (
    <div className="min-h-[100dvh] bg-background text-foreground lg:pl-64">
      <main className="mx-auto w-full max-w-[640px] pb-[130px] lg:max-w-[1280px] lg:px-6 lg:pb-16">{children}</main>
      <TabBar slug={tenant.slug} clubName={tenant.name} />
    </div>
  );
}
