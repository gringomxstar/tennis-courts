import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPasswordToken } from "@/lib/booking-link";
import { SetPasswordForm } from "./set-password-form";

/** "Passwort setzen" from an invite, guest-activation or reset mail. The token dies once a password is set. */
export default async function PasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ u?: string; e?: string; t?: string }>;
}) {
  const [{ clubSlug }, { u, e, t }] = await Promise.all([params, searchParams]);
  const exp = Number(e);
  const user = process.env.DATABASE_URL && u ? await prisma.user.findUnique({ where: { id: u } }) : null;
  const valid = Boolean(user && !user.deletedAt && verifyPasswordToken(user.id, user.passwordHash, exp, t));

  if (!user || !valid) {
    return (
      <div className="px-5 pt-[66px] lg:max-w-[560px] lg:pt-12">
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-.035em]">Link abgelaufen oder bereits benutzt</h1>
        <p className="mt-2 text-[16px] text-muted-foreground">
          Fordere einfach einen neuen an: unter Profil, &laquo;Passwort vergessen?&raquo;.
        </p>
        <Link
          href={`/c/${clubSlug}/profile`}
          className="mt-6 flex h-[56px] w-full items-center justify-center rounded-[18px] bg-clay text-[17px] font-bold text-white"
        >
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-[66px] lg:max-w-[560px] lg:pt-12">
      <h1 className="text-[34px] font-bold tracking-[-.035em]">Passwort setzen</h1>
      <p className="mt-0.5 text-[16px] text-muted-foreground">
        Hallo {user.firstName}, noch ein Passwort, dann bist du drin.
      </p>
      <SetPasswordForm slug={clubSlug} u={user.id} e={String(exp)} t={t!} email={user.email} />
    </div>
  );
}
