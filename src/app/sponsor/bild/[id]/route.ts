import { prisma } from "@/lib/prisma";

/** Catalog photo (public, shown in the sponsor portal). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const it = await prisma.sponsorItem.findUnique({ where: { id }, select: { image: true, imageType: true } });
  if (!it?.image || !it.imageType) return new Response("Nicht gefunden", { status: 404 });
  return new Response(Buffer.from(it.image), {
    headers: { "Content-Type": it.imageType, "Cache-Control": "public, max-age=300", "Content-Security-Policy": "sandbox", "X-Content-Type-Options": "nosniff" },
  });
}
