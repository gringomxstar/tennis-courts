import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyEventToken } from "@/lib/booking-link";
import { seatsTaken, waitlistPosition } from "@/lib/events";
import { EventReply } from "@/components/app/event-reply";

export const metadata: Metadata = { title: "Einladung", robots: { index: false, follow: false } };

const TZ = "Europe/Zurich";
const fmt = (d: Date) => d.toLocaleString("de-CH", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });

/** Zu-/Absage per Mail-Link. Der Token ist der einzige Schlüssel; kein Login. */
export default async function EventInvitePage({ params, searchParams }: {
  params: Promise<{ inviteId: string }>; searchParams: Promise<{ t?: string }>;
}) {
  const [{ inviteId }, { t }] = await Promise.all([params, searchParams]);
  if (!verifyEventToken(inviteId, t)) notFound();
  const inv = await prisma.eventInvite.findUnique({
    where: { id: inviteId },
    include: { event: { include: { tenant: true, invites: true } } },
  });
  if (!inv) notFound();
  const e = inv.event;
  const now = new Date();
  const taken = seatsTaken(e.invites);
  const memberView = !inv.sponsorId;
  return (
    <EventReply
      inviteId={inv.id}
      token={t!}
      clubName={e.tenant.name}
      clubLogo={e.tenant.logoUrl}
      title={e.title}
      whenText={`${fmt(e.startsAt)} bis ${e.endsAt.toLocaleTimeString("de-CH", { timeZone: TZ, timeStyle: "short" })}`}
      location={e.location}
      description={e.description}
      priceNote={e.priceNote}
      cancelled={Boolean(e.cancelledAt)}
      deadlineText={e.deadline ? fmt(e.deadline) : null}
      deadlinePassed={Boolean(e.deadline && now > e.deadline)}
      full={e.maxSeats != null && taken >= e.maxSeats}
      maxPlusOnes={e.maxPlusOnes}
      reply={inv.reply}
      plusOnes={inv.plusOnes}
      comment={inv.comment}
      waitPos={waitlistPosition(e.invites, inv.id)}
      yesCount={taken}
      names={memberView ? e.invites.filter((i) => i.reply === "YES" && !i.sponsorId).map((i) => i.name + (i.plusOnes ? ` (+${i.plusOnes})` : "")) : null}
    />
  );
}
