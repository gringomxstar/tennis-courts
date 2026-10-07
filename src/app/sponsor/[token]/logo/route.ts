import { prisma } from "@/lib/prisma";

/** Sponsor logo; the personal link is the key. SVG/PDF get a sandbox CSP so a script inside can't run on our origin. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await prisma.sponsor.findUnique({ where: { token }, select: { name: true, logo: true, logoType: true } });
  if (!s?.logo || !s.logoType) return new Response("Nicht gefunden", { status: 404 });
  const ext = s.logoType.split("/")[1].replace("svg+xml", "svg").replace("jpeg", "jpg");
  const download = new URL(req.url).searchParams.has("download");
  return new Response(Buffer.from(s.logo), {
    headers: {
      "Content-Type": s.logoType,
      "Cache-Control": "private, no-cache",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      ...(download ? { "Content-Disposition": `attachment; filename="logo-${s.name.replace(/[^\w-]+/g, "-").toLowerCase()}.${ext}"` } : {}),
    },
  });
}
