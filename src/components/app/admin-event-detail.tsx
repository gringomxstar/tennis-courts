"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/app/sheet";
import { fmt, tileOf, type Opt } from "@/components/app/admin-events";
import { chip } from "@/components/app/event-form";
import { addPersonAction, cancelEventAction, deleteEventAction, inviteAction, previewAudienceAction, remindOpenAction, setReplyAction, type Audience } from "@/app/actions/events";
import { fieldLabel } from "@/components/app/admin-sponsoring";
import { cn } from "@/lib/utils";

export type InviteRow = {
  id: string; name: string; sponsor: boolean; plusOnes: number; comment: string; reply: "INVITED" | "YES" | "NO" | "WAITLIST";
  respondedAt: string | null; mailable: boolean; hasEmail: boolean; sentAt: string | null; waitPos: number | null;
};
export type Person = { key: string; name: string; sponsor: boolean; mailable: boolean };
type Ev = { id: string; title: string; startsAt: string; endsAt: string; location: string; deadline: string | null; maxSeats: number | null; mailMembers: boolean; cancelled: boolean; seats: number };

const TABS = [["YES", "Zugesagt"], ["INVITED", "Offen"], ["NO", "Abgesagt"], ["WAITLIST", "Warteliste"]] as const;
const COLS = "@min-[1024px]:grid @min-[1024px]:grid-cols-[24px_minmax(0,2fr)_90px_110px_minmax(0,1.6fr)_110px_130px] @min-[1024px]:gap-4";

export function AdminEventDetail({ slug, event: e, rows, people, plans }: { slug: string; event: Ev; rows: InviteRow[]; people: Person[]; plans: Opt[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<InviteRow["reply"]>(rows.some((r) => r.reply === "YES") ? "YES" : "INVITED");
  const [sel, setSel] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const shown = rows.filter((r) => r.reply === tab);
  const open = rows.filter((r) => r.reply === "INVITED");
  const allOn = shown.length > 0 && shown.every((r) => sel.includes(r.id));
  const draft = rows.length === 0;
  const pct = e.maxSeats ? Math.min(100, (e.seats / e.maxSeats) * 100) : 0;
  const done = (msg: string) => { toast(msg); router.refresh(); };
  const invitedDone = (msg: string) => { setTab("INVITED"); setSel([]); done(msg); };
  const mailed = rows.filter((r) => r.sentAt).length;
  const appOnly = rows.filter((r) => !r.sentAt && !r.sponsor && !e.mailMembers && r.hasEmail).length;
  const inviteInfo = (r: InviteRow) =>
    r.sentAt ? `Mail gesendet ${fmt(r.sentAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(", ", " ")}`
    : !r.sponsor && !e.mailMembers ? "nur in der App" : !r.hasEmail ? "keine E-Mail" : "Mail ausstehend";

  function remind() {
    const targets = (sel.length ? open.filter((r) => sel.includes(r.id)) : open).filter((r) => r.mailable);
    if (!targets.length) return void toast("Keine Offenen mit E-Mail.");
    if (!window.confirm(`Achtung: Das verschickt ${targets.length} ECHTE E-Mails an Offene. Fortfahren?`)) return;
    start(async () => {
      const r = await remindOpenAction(slug, e.id, sel.length ? targets.map((t) => t.id) : undefined);
      if (r.success) { setSel([]); done(`${r.sent} Erinnerungen gesendet`); } else toast.error(r.error);
    });
  }
  function setReply(r: InviteRow, v: "YES" | "NO") {
    start(async () => {
      const res = await setReplyAction(slug, r.id, v);
      if (!res.success) return void toast.error(res.error);
      done(res.reply === "WAITLIST" ? `${r.name}: Warteliste (voll)` : `${r.name}: ${v === "YES" ? "Zusage" : "Absage"} gesetzt`);
    });
  }
  function add(p: Person) {
    if (p.mailable && !window.confirm("Achtung: Das verschickt 1 ECHTE E-Mail. Fortfahren?")) return;
    start(async () => {
      const r = await addPersonAction(slug, e.id, p.key);
      if (!r.success) return void toast.error(r.error);
      setAdding(false);
      invitedDone(`${p.name} eingeladen${r.mailed ? " (Mail gesendet)" : ""}`);
    });
  }
  const cancel = () => window.confirm("Achtung: Der Anlass wird abgesagt, Sperren entfallen und alle Zusagen und Wartenden mit E-Mail erhalten ECHTE E-Mails. Fortfahren?") &&
    start(async () => {
      const r = await cancelEventAction(slug, e.id);
      if (r.success) done("Abgesagt"); else toast.error(r.error);
    });
  const remove = () => window.confirm("Anlass mit allen Einladungen endgültig löschen? Es wird keine Mail verschickt.") &&
    start(async () => {
      const r = await deleteEventAction(slug, e.id);
      if (r.success) { toast("Gelöscht"); router.push(`/c/${slug}/admin/events`); router.refresh(); } else toast.error(r.error);
    });

  const needle = q.trim().toLowerCase();
  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 @min-[640px]:gap-4 @min-[640px]:px-0 @min-[640px]:pt-0">
      <Link href={`/c/${slug}/admin/events`} className="h-8 text-[14px] font-semibold text-brand-deep">‹ Anlässe</Link>
      <div className="card flex flex-col gap-3 p-4 @min-[640px]:p-5">
        <div className="flex items-center gap-3">
          {tileOf(e.startsAt)}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-bold tracking-[-.03em]">{e.title}</h1>
            <div className="text-[13.5px] text-ink-3">
              {fmt(e.startsAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}–{fmt(e.endsAt, { hour: "2-digit", minute: "2-digit" })}
              {e.location ? ` · ${e.location}` : ""}
            </div>
            {e.deadline && <div className="text-[13.5px] text-ink-3">Anmeldeschluss {fmt(e.deadline, { day: "numeric", month: "numeric", year: "numeric" })}</div>}
          </div>
          <span className={cn("pill shrink-0", e.cancelled ? "bg-bad-bg text-bad" : "bg-bg text-ink-2")}>{e.cancelled ? "Abgesagt" : draft ? "Entwurf" : e.mailMembers ? "Mail" : "nur App"}</span>
        </div>
        {!draft && <div className="text-[13.5px] text-ink-2">{rows.length} eingeladen · {mailed} per Mail · {appOnly} nur App</div>}
        <div>
          <div className="flex justify-between text-[13.5px] font-semibold"><span>Belegung</span><span>{e.seats}{e.maxSeats ? ` / ${e.maxSeats}` : " Plätze"}</span></div>
          {e.maxSeats && <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg"><div className={cn("h-full rounded-full", pct >= 100 ? "bg-warn" : "bg-brand-deep")} style={{ width: `${pct}%` }} /></div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!e.cancelled && !draft && <button type="button" onClick={() => setInviting(true)} className="btn btn-ghost">Weitere einladen …</button>}
          {!e.cancelled && !draft && <button type="button" disabled={pending} onClick={remind} className="btn btn-pri">{sel.length ? `${sel.length} erinnern` : "Offene erinnern"}</button>}
          {!e.cancelled && <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost">+ Person einladen</button>}
          <a href={`/c/${slug}/admin/events/${e.id}/export`} className="btn btn-ghost">CSV</a>
          {!e.cancelled && <Link href={`/c/${slug}/admin/events/${e.id}/bearbeiten`} className="btn btn-ghost">Bearbeiten</Link>}
          {!e.cancelled && <button type="button" disabled={pending} onClick={cancel} className="btn btn-ghost">Absagen</button>}
          <button type="button" disabled={pending} onClick={remove} className="btn btn-ghost !text-bad">Löschen</button>
        </div>
      </div>
      {draft && !e.cancelled && (
        <div className="card flex flex-wrap items-center gap-3 border border-warn p-4">
          <span className="min-w-0 flex-1 text-[15px] font-semibold">Entwurf – noch niemand eingeladen</span>
          <button type="button" onClick={() => setInviting(true)} className="btn btn-pri">Einladen …</button>
        </div>
      )}
      {inviting && <InviteSheet slug={slug} event={e} plans={plans} onClose={() => setInviting(false)} onDone={invitedDone} />}
      <Sheet open={adding} onOpenChange={setAdding} title="Person einladen">
        <div className="grid gap-3">
          <div className="text-[24px] font-bold tracking-[-.03em]">Person einladen</div>
          <input type="search" aria-label="Suchen" placeholder="Name suchen" value={q} onChange={(ev) => setQ(ev.target.value)} className="h-[46px] rounded-full bg-bg px-4 text-[16px] outline-none" />
          <div className="max-h-[50dvh] overflow-y-auto">
            {people.filter((p) => !needle || p.name.toLowerCase().includes(needle)).slice(0, 50).map((p) => (
              <button key={p.key} type="button" disabled={pending} onClick={() => add(p)} className="flex min-h-11 w-full items-center gap-2 border-t border-line px-1 text-left first:border-t-0">
                <span className="flex-1 truncate text-[15px] font-semibold">{p.name}</span>
                <span className="pill h-5 bg-bg px-2 text-[11px] text-ink-2">{p.sponsor ? "Sponsor" : "Mitglied"}</span>
                {!p.mailable && <span className="text-[12px] text-ink-3">nur App</span>}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
      <div className="card p-4 @min-[640px]:p-5">
        <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 py-1">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); setSel([]); }} className="chip bg-bg shadow-none aria-pressed:bg-ink aria-pressed:text-card aria-pressed:shadow-none">
              {label} <span className="opacity-60">{rows.filter((r) => r.reply === id).length}</span>
            </button>
          ))}
        </div>
        <div className={cn("hidden px-3 pb-3 text-[12.5px] font-semibold text-ink-3", COLS)}>
          <input type="checkbox" aria-label="Alle auswählen" checked={allOn} onChange={() => setSel(allOn ? [] : shown.map((r) => r.id))} className="h-[18px] w-[18px] accent-brand-deep" />
          <span>Name</span><span>Typ</span><span>Begleitung</span><span>Bemerkung</span><span>Antwort am</span><span>Antwort</span>
        </div>
        {!shown.length && <div className="py-6 text-center text-[15px] text-ink-2">Niemand in dieser Liste</div>}
        {shown.map((r) => (
          <div key={r.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-2.5 first:border-t-0", COLS, sel.includes(r.id) && "rounded-[14px] bg-brand-tint")}>
            <input type="checkbox" aria-label={`${r.name} auswählen`} checked={sel.includes(r.id)} onChange={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} className="h-[18px] w-[18px] shrink-0 accent-brand-deep" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold @min-[1024px]:flex-none">{r.name}{r.waitPos ? ` · Platz ${r.waitPos}` : ""}<span className="block text-[12px] font-normal text-ink-3">{inviteInfo(r)}</span></span>
            <span className="pill h-5 bg-bg px-2 text-[11px] text-ink-2">{r.sponsor ? "Sponsor" : "Mitglied"}</span>
            <span className="text-[13.5px] text-ink-2">{r.plusOnes ? `+${r.plusOnes}` : <span className="@min-[1024px]:inline hidden">–</span>}</span>
            <span className="basis-full truncate text-[13px] text-ink-2 @min-[1024px]:basis-auto">{r.comment || ""}</span>
            <span className="text-[12.5px] text-ink-3">{r.respondedAt ? fmt(r.respondedAt, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
            {e.cancelled ? <span /> : (
              <select aria-label={`Antwort von ${r.name}`} value={r.reply} disabled={pending} onChange={(ev) => setReply(r, ev.target.value as "YES" | "NO")} className="h-10 rounded-[12px] border border-border bg-inset px-2 text-[14px]">
                <option value="INVITED" disabled>Offen</option>
                <option value="WAITLIST" disabled>Warteliste</option>
                <option value="YES">Zusage</option>
                <option value="NO">Absage</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Einladen: Zielgruppe + Versandart, erst hier wird verschickt. */
function InviteSheet({ slug, event: e, plans, onClose, onDone }: { slug: string; event: Ev; plans: Opt[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [aud, setAud] = useState<"all" | "abo" | "none">("all");
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [sponsors, setSponsors] = useState(false);
  const [mail, setMail] = useState(e.mailMembers);
  const [count, setCount] = useState<{ members: number; sponsors: number; noEmail: number; mails: number } | null>(null);
  const [pending, start] = useTransition();
  const toggleIn = (l: string[], id: string) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]);
  const audience: Audience = { members: aud === "all" || (aud === "abo" && planIds.length > 0), planIds: aud === "abo" ? planIds : [], sponsors };
  const noTarget = !audience.members && !sponsors;
  const aKey = JSON.stringify([audience, mail]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void previewAudienceAction(slug, audience, mail, e.id).then((r) => live && r.success && setCount(r));
    }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aKey, slug, e.id]);

  const mails = count?.mails ?? 0;
  function send() {
    const n = (count?.members ?? 0) + (count?.sponsors ?? 0);
    const msg = mails > 0 ? `Achtung: Das verschickt ${mails} ECHTE E-Mails. Fortfahren?` : `${n} Personen in der App einladen? Es werden keine E-Mails verschickt.`;
    if (!window.confirm(msg)) return;
    start(async () => {
      const r = await inviteAction(slug, e.id, audience, mail);
      if (!r.success) return void toast.error(r.error);
      onClose();
      onDone(`${r.invited} eingeladen, ${r.mailed} Mails gesendet${r.skippedNoEmail ? `, ${r.skippedNoEmail} ohne E-Mail` : ""}`);
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Einladen">
      <div className="grid gap-3">
        <div className="text-[24px] font-bold tracking-[-.03em]">Einladen</div>
        <div>
          <div className={fieldLabel}>Zielgruppe</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button type="button" aria-pressed={aud === "all"} onClick={() => setAud(aud === "all" ? "none" : "all")} className={chip}>Alle Mitglieder</button>
            <button type="button" aria-pressed={aud === "abo"} onClick={() => setAud(aud === "abo" ? "none" : "abo")} className={chip}>Abo-Typ …</button>
            <button type="button" aria-pressed={sponsors} onClick={() => setSponsors((v) => !v)} className={chip}>Sponsoren</button>
          </div>
          {aud === "abo" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {plans.map((p) => <button key={p.id} type="button" aria-pressed={planIds.includes(p.id)} onClick={() => setPlanIds(toggleIn(planIds, p.id))} className={chip}>{p.name}</button>)}
            </div>
          )}
        </div>
        <div>
          <div className={fieldLabel}>Versand</div>
          <div className="mt-1.5 flex gap-2">
            <button type="button" aria-pressed={mail} onClick={() => setMail(true)} className={chip}>per Mail</button>
            <button type="button" aria-pressed={!mail} onClick={() => setMail(false)} className={chip}>nur in der App</button>
          </div>
          {!mail && <p className="mt-1.5 text-[13px] text-warn">Gilt für Mitglieder. Sponsoren erhalten ihre Einladung immer per Mail.</p>}
        </div>
        <p className="rounded-[14px] bg-inset p-3 text-[14px]">
          {count ? <><b>{count.members}</b> Mitglieder · <b>{count.sponsors}</b> Sponsoren neu · {count.noEmail} ohne E-Mail · <b>{count.mails}</b> Mails</> : "Zähle …"}
        </p>
        <button type="button" disabled={pending || noTarget} onClick={send} className="btn btn-pri h-[52px] w-full">{pending ? "Sende …" : "Einladen"}</button>
      </div>
    </Sheet>
  );
}
