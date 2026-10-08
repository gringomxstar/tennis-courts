"use client";

import { useState, useTransition } from "react";
import { replyByToken, replyMine } from "@/app/actions/event-reply";

type R = "INVITED" | "YES" | "NO" | "WAITLIST";

const Stepper = ({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[14.5px] font-semibold">{label}</span>
    <span className="inline-flex items-center gap-3">
      <button type="button" aria-label="Weniger" disabled={value <= 0} onClick={() => onChange(value - 1)} className="btn btn-ghost h-[42px] w-[42px] px-0 text-[20px]">−</button>
      <b className="w-5 text-center text-[17px]">{value}</b>
      <button type="button" aria-label="Mehr" disabled={value >= max} onClick={() => onChange(value + 1)} className="btn btn-ghost h-[42px] w-[42px] px-0 text-[20px]">+</button>
    </span>
  </div>
);

const statusText = (r: R, pos: number | null) =>
  r === "YES" ? "Du bist dabei" : r === "WAITLIST" ? `Warteliste, Platz ${pos ?? "?"}` : r === "NO" ? "Abgesagt" : "";

export type PublicEvent = {
  inviteId: string; token: string; clubName: string; clubLogo: string | null; title: string; whenText: string; location: string | null;
  description: string | null; priceNote: string | null; cancelled: boolean; deadlineText: string | null; deadlinePassed: boolean; full: boolean;
  maxPlusOnes: number; reply: R; plusOnes: number; comment: string | null; waitPos: number | null;
  yesCount: number; names: string[] | null; // names only for member invites; sponsors see the count
};

/** Öffentliche Zu-/Absage-Seite (Link aus der Mail, kein Login). Speichern nur per POST (Server Action). */
export function EventReply(p: PublicEvent) {
  const [editing, setEditing] = useState(p.reply === "INVITED");
  const [plus, setPlus] = useState(p.plusOnes);
  const [comment, setComment] = useState(p.comment ?? "");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const send = (v: "YES" | "NO") =>
    start(async () => {
      setErr("");
      const r = await replyByToken(p.inviteId, p.token, v, v === "YES" ? plus : 0, comment);
      if (r.success) setEditing(false);
      else setErr(r.error);
    });
  const closed = p.deadlinePassed && !p.cancelled;
  const ics = `/e/${p.inviteId}/ics?t=${p.token}`;

  return (
    <main className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-5 pb-10 pt-10">
      <div className="flex items-center gap-2.5 text-[17px] font-bold">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
        {p.clubLogo ? <img src={p.clubLogo} alt="" className="h-[42px] w-[42px] object-contain" /> : <i className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] bg-brand-deep text-[13px] font-extrabold not-italic text-white">TC</i>}
        {p.clubName}
      </div>

      <div className="card flex flex-col gap-2 p-5">
        <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-.02em]">{p.title}</h1>
        <div className="text-[15px] font-medium">{p.whenText}</div>
        {p.location && <div className="text-[14.5px] text-ink-2">{p.location}</div>}
        {p.description && <p className="whitespace-pre-line text-[14.5px] text-ink-2">{p.description}</p>}
        {p.priceNote && <div className="text-[14.5px]"><b>Kosten:</b> {p.priceNote}</div>}
        {p.deadlineText && <div className="text-[13px] text-ink-3">Anmeldeschluss: {p.deadlineText}</div>}
      </div>

      {p.cancelled ? (
        <div className="card p-5 text-[15px] font-semibold text-warn">Dieser Anlass wurde abgesagt.</div>
      ) : editing ? (
        <div className="card flex flex-col gap-4 p-5">
          {closed && <div className="text-[14px] text-warn">Der Anmeldeschluss ist vorbei. Eine Absage ist weiterhin möglich.</div>}
          {!closed && p.full && <div className="text-[14px] text-warn">Der Anlass ist voll. Deine Zusage kommt auf die Warteliste.</div>}
          {!closed && p.maxPlusOnes > 0 && <Stepper label="Begleitpersonen" value={plus} max={p.maxPlusOnes} onChange={setPlus} />}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder="Bemerkung, z.B. Allergien (optional)" className="w-full rounded-2xl bg-bg px-4 py-3 text-[15px] outline-none" />
          {err && <div role="alert" className="text-[14px] text-warn">{err}</div>}
          <div className="flex flex-col gap-2.5">
            {!closed && <button type="button" disabled={pending} onClick={() => send("YES")} className="btn btn-pri h-[54px] w-full text-[16px]">Ich komme</button>}
            <button type="button" disabled={pending} onClick={() => send("NO")} className="btn h-[54px] w-full text-[16px]">Ich komme nicht</button>
            {p.reply !== "INVITED" && <button type="button" onClick={() => setEditing(false)} className="text-[14px] font-semibold text-brand-deep">Abbrechen</button>}
          </div>
        </div>
      ) : (
        <div className="card flex flex-col gap-3 p-5">
          <div className="text-[20px] font-semibold">{statusText(p.reply, p.waitPos)}</div>
          {p.reply === "YES" && p.plusOnes > 0 && <div className="text-[14.5px] text-ink-2">mit {p.plusOnes} Begleitperson{p.plusOnes > 1 ? "en" : ""}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className="btn">Antwort ändern</button>
            {(p.reply === "YES" || p.reply === "WAITLIST") && <a href={ics} className="btn">In Kalender eintragen</a>}
          </div>
        </div>
      )}

      {!p.cancelled && (
        <div className="card p-5">
          {p.names ? (
            <>
              <h2 className="mb-2 text-[15px] font-semibold">Wer kommt? ({p.yesCount})</h2>
              <div className="text-[14.5px] text-ink-2">{p.names.length ? p.names.join(", ") : "Noch niemand."}</div>
            </>
          ) : (
            <div className="text-[14.5px] text-ink-2"><b>{p.yesCount}</b> Zusage{p.yesCount === 1 ? "" : "n"} bisher.</div>
          )}
        </div>
      )}
    </main>
  );
}

export type MemberEvent = {
  inviteId: string; title: string; whenText: string; location: string | null; reply: R; plusOnes: number; waitPos: number | null;
  maxPlusOnes: number; deadlinePassed: boolean; yesCount: number; names: string[];
};

/** Karte «Nächste Anlässe» auf der Startseite. */
export function MemberEvents({ slug, events }: { slug: string; events: MemberEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="card p-5">
      <h2 className="mb-3.5 text-[17px] font-semibold">Nächste Anlässe</h2>
      <div className="flex flex-col gap-3">
        {events.map((e) => <MemberEventRow key={e.inviteId + e.reply + e.plusOnes} slug={slug} e={e} />)}
      </div>
    </div>
  );
}

function MemberEventRow({ slug, e }: { slug: string; e: MemberEvent }) {
  const [plus, setPlus] = useState(e.plusOnes);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const send = (v: "YES" | "NO", n = 0) =>
    start(async () => {
      setErr("");
      const r = await replyMine(slug, e.inviteId, v, n);
      if (!r.success) setErr(r.error);
    });
  const going = e.reply === "YES" || e.reply === "WAITLIST";
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-bg p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <b className="block text-[15px] font-semibold">{e.title}</b>
          <small className="block text-[12.5px] text-ink-3">{e.whenText}{e.location ? `, ${e.location}` : ""}</small>
        </span>
        {e.reply !== "INVITED" && <span className={`pill ${e.reply === "YES" ? "bg-ok-bg text-ok" : e.reply === "NO" ? "bg-card text-ink-2" : "bg-warn-bg text-warn"}`}>{statusText(e.reply, e.waitPos)}</span>}
      </div>
      {going && e.maxPlusOnes > 0 && (
        <Stepper label="Begleitpersonen" value={plus} max={e.maxPlusOnes} onChange={(n) => { setPlus(n); send("YES", n); }} />
      )}
      <div className="flex flex-wrap gap-2">
        {!e.deadlinePassed && e.reply !== "YES" && e.reply !== "WAITLIST" && <button type="button" disabled={pending} onClick={() => send("YES", plus)} className="btn btn-pri flex-1">Ich komme</button>}
        {e.reply !== "NO" && <button type="button" disabled={pending} onClick={() => send("NO")} className="btn flex-1">{going ? "Absagen" : "Nein"}</button>}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="btn btn-ghost flex-1">Wer kommt? ({e.yesCount})</button>
      </div>
      {open && <div className="text-[13.5px] text-ink-2">{e.names.length ? e.names.join(", ") : "Noch niemand."}</div>}
      {err && <div role="alert" className="text-[13px] text-warn">{err}</div>}
    </div>
  );
}
