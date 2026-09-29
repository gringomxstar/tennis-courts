import { requireTenantAdmin } from "@/lib/tenant";
import { ProfileView } from "@/components/app/profile-view";
import { getUserClubs } from "@/lib/data";

// Admin mode shows no wallet/Abo cards (as in the design), so nothing else to load.
export default async function AdminProfilePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const ctx = await requireTenantAdmin(clubSlug);
  return (
    <ProfileView
      slug={ctx.tenant.slug}
      clubName={ctx.tenant.name}
      user={ctx.user && { name: ctx.user.name || ctx.user.email }}
      canAdmin
      admin
      wallet={0}
      membership={null}
      profile={null}
      support={{}}
      clubs={ctx.user ? await getUserClubs(ctx.user.id) : []}
    />
  );
}
