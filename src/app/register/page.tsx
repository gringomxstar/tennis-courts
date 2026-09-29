import { redirect } from "next/navigation";
import { getAllTenants } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Registration lives in the club profile (club-specific, no hard-coded club list). */
export default async function RegisterPage() {
  const [first] = await getAllTenants();
  redirect(first ? `/c/${first.slug}/profile?register=1` : "/");
}
