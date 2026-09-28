import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  redirect(`/c/${session?.user?.tenants?.[0]?.slug ?? "tc-marly"}/profile`);
}
