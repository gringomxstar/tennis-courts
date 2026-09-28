import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function MembershipPage() {
  const tenant = await prisma.tenant.findFirst({ where: { status: "ACTIVE" } }).catch(() => null);
  redirect(`/c/${tenant?.slug ?? "tc-marly"}/profile?abo=1`);
}
