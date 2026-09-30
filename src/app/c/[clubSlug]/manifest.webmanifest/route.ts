import { prisma } from "@/lib/prisma";

// Per-club web app manifest: name, colour and icon come from the club's branding.
export async function GET(_req: Request, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug: clubSlug }, select: { name: true, settingsJson: true } });
  if (!t) return new Response("Not found", { status: 404 });
  const brand = (t.settingsJson as { brandColor?: string } | null)?.brandColor;
  return Response.json(
    {
      name: t.name,
      short_name: t.name.slice(0, 12).trim(),
      description: `Plätze bei ${t.name} reservieren`,
      start_url: `/c/${clubSlug}`,
      scope: `/c/${clubSlug}`,
      display: "standalone",
      background_color: "#0b0f17",
      theme_color: brand ?? "#0b0f17",
      icons: [192, 512].map((s) => ({ src: `/c/${clubSlug}/icon?s=${s}`, sizes: `${s}x${s}`, type: "image/png", purpose: "any" })),
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=0, s-maxage=3600" } }
  );
}
