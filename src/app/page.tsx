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
      <main className="mx-auto w-full max-w-[640px] px-5 pb-16 pt-[max(40px,env(safe-area-inset-top))] sm:pt-24">
        <h1 className="text-[36px] font-bold leading-[1.02] tracking-[-.04em]">Wo spielst du?</h1>
        <p className="mt-3 text-[16px] text-ink-2">Wähle deinen Club.</p>
        <ul className="mt-8 flex flex-col gap-2.5">
          {tenants.map((t) => (
            <li key={t.id}>
              <Link href={`/c/${t.slug}`} className="card flex items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[19px] font-bold tracking-[-.02em]">{t.name}</div>
                  {t.address && <div className="truncate text-[14px] text-ink-2">{t.address}</div>}
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
      <h1 className="text-[32px] font-bold leading-[1.05] tracking-[-.03em]">Gerade nicht erreichbar.</h1>
      <p className="mt-3 text-[16px] text-ink-2">Die Clubdaten konnten nicht geladen werden. Bitte versuche es später noch einmal.</p>
    </main>
  );
}
