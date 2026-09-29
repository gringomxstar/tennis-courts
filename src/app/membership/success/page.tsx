import Link from "next/link";
import { auth } from "@/auth";

export default async function MembershipSuccessPage() {
  // Same target as /dashboard used to redirect to: the user's first club.
  const session = await auth();
  const slug = session?.user?.tenants?.[0]?.slug ?? "tc-marly";

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-24 text-foreground">
      <div role="status" className="flex w-full max-w-[400px] flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-clay animate-[pop_.6s_var(--ease-spring)]">
          <svg aria-hidden width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="mt-5 text-[34px] font-bold tracking-[-.035em]">Danke für deinen Kauf.</h1>
        <p className="mt-1 text-[16px] text-muted-foreground">
          Dein Abo ist in wenigen Sekunden aktiv. Danach buchst du Sandplätze ohne Platzgebühr.
        </p>
        <Link
          href={`/c/${slug}/calendar`}
          className="mt-8 flex h-[60px] w-full items-center justify-center rounded-[20px] bg-clay text-[18px] font-bold text-white active:scale-[.97]"
        >
          Jetzt Platz buchen
        </Link>
        <Link href={`/c/${slug}/profile`} className="mt-4 text-[16px] font-semibold text-clay-text">
          Zum Profil
        </Link>
      </div>
    </div>
  );
}
