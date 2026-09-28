import Link from "next/link";
import { auth } from "@/auth";

export default async function MembershipSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  // Same target as /dashboard used to redirect to: the user's first club.
  const session = await auth();
  const slug = session?.user?.tenants?.[0]?.slug ?? "tc-marly";

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-24 text-foreground">
      <div role="status" className="flex w-full max-w-[400px] flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-clay animate-[pop_.6s_var(--ease-spring)]">
          <svg aria-hidden width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="mt-5 text-[34px] font-bold tracking-[-.035em]">Freigeschaltet.</h1>
        <p className="mt-1 text-[16px] text-muted-foreground">
          Danke für deinen Abo-Kauf. Dein Zugang wird in den nächsten Augenblicken automatisch aktiviert.
        </p>
        {session_id && (
          <p className="mt-4 break-all text-[12px] text-muted-foreground">Referenz: {session_id}</p>
        )}
        <Link
          href={`/c/${slug}/profile`}
          className="mt-8 flex h-[60px] w-full items-center justify-center rounded-[20px] bg-clay text-[18px] font-bold text-white active:scale-[.97]"
        >
          Zum Profil
        </Link>
      </div>
    </div>
  );
}
