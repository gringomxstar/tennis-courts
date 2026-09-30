import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

const HEX = /^#[0-9a-f]{6}$/i;

// Per-club favicon / home-screen icon: the club's uploaded logo on white, else its initials on the club colour.
// PNG on purpose — iOS and Android ignore SVG for home-screen icons. ?s= is the pixel size (default 180).
export async function GET(req: Request, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const s = Math.min(512, Math.max(32, Number(new URL(req.url).searchParams.get("s")) || 180));
  const t = await prisma.tenant.findUnique({ where: { slug: clubSlug }, select: { name: true, logoUrl: true, settingsJson: true } });
  if (!t) return new Response("Not found", { status: 404 });
  const brand = (t.settingsJson as { brandColor?: string } | null)?.brandColor;
  const bg = brand && HEX.test(brand) ? brand : "#e25b36";
  const ini = t.name.replace(/[^A-ZÄÖÜ]/g, "").slice(0, 2) || t.name.slice(0, 2).toUpperCase();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: t.logoUrl ? "#fff" : bg }}>
        {t.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered by satori, not the browser
          <img src={t.logoUrl} alt="" style={{ width: "82%", height: "82%", objectFit: "contain" }} />
        ) : (
          <div style={{ color: "#fff", fontSize: s * 0.42, fontWeight: 800 }}>{ini}</div>
        )}
      </div>
    ),
    { width: s, height: s, headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
