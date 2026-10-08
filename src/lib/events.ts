// Anlässe: reine Regeln ohne DB (Vorlagen, Plätze, Warteliste, ICS).
export type EventReplyValue = "INVITED" | "YES" | "NO" | "WAITLIST";

export const EVENT_TEMPLATES = {
  apero: { label: "Apéro", title: "Apéro", durationMin: 120, deadlineDays: 3, maxSeats: null, maxPlusOnes: 1, blockCourts: "none", audience: { members: true, sponsors: false } },
  clubturnier: { label: "Clubturnier", title: "Clubturnier", durationMin: 480, deadlineDays: 7, maxSeats: 32, maxPlusOnes: 0, blockCourts: "all", audience: { members: true, sponsors: false } },
  saisoneroeffnung: { label: "Saisoneröffnung", title: "Saisoneröffnung", durationMin: 240, deadlineDays: 5, maxSeats: null, maxPlusOnes: 2, blockCourts: "all", audience: { members: true, sponsors: true } },
  sponsorenapero: { label: "Sponsorenapéro", title: "Sponsorenapéro", durationMin: 120, deadlineDays: 7, maxSeats: 40, maxPlusOnes: 1, blockCourts: "none", audience: { members: false, sponsors: true } },
  grillabend: { label: "Grillabend", title: "Grillabend", durationMin: 180, deadlineDays: 3, maxSeats: 50, maxPlusOnes: 2, blockCourts: "none", audience: { members: true, sponsors: false } },
  leer: { label: "Leer", title: "", durationMin: 120, deadlineDays: 3, maxSeats: null, maxPlusOnes: 0, blockCourts: "none", audience: { members: true, sponsors: false } },
} as const satisfies Record<string, {
  label: string; title: string; durationMin: number; deadlineDays: number; maxSeats: number | null; maxPlusOnes: number;
  blockCourts: "all" | "none"; audience: { members: boolean; sponsors: boolean };
}>;

type Inv = { id: string; reply: EventReplyValue; plusOnes: number; respondedAt: Date | null };
type Ev = { maxSeats: number | null; maxPlusOnes: number; deadline: Date | null };

const heads = (i: { plusOnes: number }) => 1 + i.plusOnes;

/** Belegte Plätze: Σ(1+Begleitpersonen) aller Zusagen. */
export const seatsTaken = (invites: { reply: EventReplyValue; plusOnes: number }[]) =>
  invites.reduce((n, i) => (i.reply === "YES" ? n + heads(i) : n), 0);

const waitOrder = <T extends { respondedAt: Date | null }>(l: T[]) =>
  [...l].sort((a, b) => (a.respondedAt?.getTime() ?? 0) - (b.respondedAt?.getTime() ?? 0));

export const waitlistPosition = (invites: Inv[], inviteId: string) => {
  const i = waitOrder(invites.filter((x) => x.reply === "WAITLIST")).findIndex((x) => x.id === inviteId);
  return i < 0 ? null : i + 1;
};

/** Neue Zustände nach einer Antwort; wirft bei Regelverstoss. `promoted` = Ids der Nachgerückten. */
export function applyReply(event: Ev, invites: Inv[], inviteId: string, reply: "YES" | "NO", plusOnes: number, now: Date) {
  const me = invites.find((i) => i.id === inviteId);
  if (!me) throw new Error("Einladung nicht gefunden.");
  if (reply === "YES" && event.deadline && now > event.deadline) throw new Error("Der Anmeldeschluss ist vorbei.");
  if (!Number.isInteger(plusOnes) || plusOnes < 0 || plusOnes > event.maxPlusOnes) throw new Error(`Maximal ${event.maxPlusOnes} Begleitperson(en).`);
  const next = invites.map((i) => ({ ...i }));
  const mine = next.find((i) => i.id === inviteId)!;
  if (reply === "NO") {
    Object.assign(mine, { reply: "NO", plusOnes: 0, respondedAt: now });
  } else {
    const others = seatsTaken(next.filter((i) => i.id !== inviteId));
    const fits = event.maxSeats == null || others + 1 + plusOnes <= event.maxSeats;
    const stayWaiting = !fits && me.reply === "WAITLIST";
    Object.assign(mine, { reply: fits ? "YES" : "WAITLIST", plusOnes, respondedAt: stayWaiting ? me.respondedAt : now });
  }
  const promoted: string[] = [];
  if (event.maxSeats != null) {
    let taken = seatsTaken(next);
    for (const w of waitOrder(next.filter((i) => i.reply === "WAITLIST" && i.id !== inviteId))) {
      if (taken + heads(w) <= event.maxSeats) {
        w.reply = "YES";
        taken += heads(w);
        promoted.push(w.id);
      }
    }
  }
  return { invites: next, promoted };
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function icsFor(event: { id: string; title: string; startsAt: Date; endsAt: Date; location?: string | null; description?: string | null }, url: string) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TennisCourts//Anlaesse//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@tenniscourts`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(event.startsAt)}`,
    `DTEND:${utc(event.endsAt)}`,
    `SUMMARY:${esc(event.title)}`,
    ...(event.location ? [`LOCATION:${esc(event.location)}`] : []),
    `DESCRIPTION:${esc([event.description, url].filter(Boolean).join("\n"))}`,
    `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
