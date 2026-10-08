import { prisma } from "@/lib/prisma";
import { eventLink, verifyEventToken } from "@/lib/booking-link";
import { icsFor } from "@/lib/events";

export async function GET(req: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await params;
  const t = new URL(req.url).searchParams.get("t") ?? undefined;
  if (!verifyEventToken(inviteId, t)) return new Response("Not found", { status: 404 });
  const inv = await prisma.eventInvite.findUnique({ where: { id: inviteId }, include: { event: true } });
  if (!inv) return new Response("Not found", { status: 404 });
  return new Response(icsFor(inv.event, eventLink(inviteId)), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="anlass.ics"' },
  });
}
