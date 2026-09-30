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
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4 px-5 pb-8 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2">
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-.03em]">Link abgelaufen oder bereits benutzt</h1>
        <p className="text-[16px] text-ink-2">
          Fordere einfach einen neuen an: unter Profil, Passwort vergessen.
        </p>
        <Link
          href={`/c/${clubSlug}/profile`}
          className="btn btn-pri h-[54px] w-full text-[16px]"
        >
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4 px-5 pb-8 pt-[60px] @min-[640px]:px-0 @min-[640px]:pt-2">
      <h1 className="text-[28px] font-bold tracking-[-.03em]">Passwort setzen</h1>
      <p className="text-[15px] text-ink-2">
        Hallo {user.firstName}, noch ein Passwort, dann bist du drin.
      </p>
      <SetPasswordForm slug={clubSlug} u={user.id} e={String(exp)} t={t!} email={user.email} />
    </div>
  );
}
