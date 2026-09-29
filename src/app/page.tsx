import Link from "next/link";
import { redirect } from "next/navigation";
import { Chevron } from "@/components/app/avatar";
import { getAllTenants } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tenants = await getAllTenants();
  if (tenants.length === 1) redirect(`/c/${tenants[0].slug}`);

  if (tenants.length > 1) {
    return (
      <main className="mx-auto w-full max-w-[640px] px-5 pb-16 pt-[max(40px,env(safe-area-inset-top))] lg:pt-24">
        <h1 className="text-[56px] font-bold leading-[.98] tracking-[-.05em]">Wo spielst du?</h1>
        <p className="mt-3 text-[17px] text-muted-foreground">Wähle deinen Club.</p>
        <ul className="mt-8 flex flex-col gap-2.5">
          {tenants.map((t) => (
            <li key={t.id}>
              <Link href={`/c/${t.slug}`} className="flex items-center gap-3 rounded-[22px] border border-border bg-card px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[19px] font-bold tracking-[-.02em]">{t.name}</div>
                  {t.address && <div className="truncate text-[14px] text-muted-foreground">{t.address}</div>}
                </div>
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-[42px] font-bold leading-[1.02] tracking-[-.035em]">Gerade nicht erreichbar.</h1>
      <p className="mt-3 text-[16px] text-muted-foreground">Die Clubdaten konnten nicht geladen werden. Bitte versuche es später noch einmal.</p>
    </main>
  );
}
