import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default async function MembershipSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-24 selection:bg-clay/30">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-clay/10 text-clay mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Zahlung erfolgreich!</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Danke für deinen Abo-Kauf. Dein Zugang wird in den nächsten Augenblicken automatisch freigeschaltet.
        </p>
        {session_id && (
          <p className="text-xs font-mono text-slate-400 mb-8 break-all">Referenz: {session_id}</p>
        )}
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 rounded-xl font-bold bg-clay text-white hover:bg-clay-hover transition-colors"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
