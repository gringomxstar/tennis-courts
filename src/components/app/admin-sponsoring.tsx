"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { chf } from "@/lib/sponsoring";
import { parseSponsors } from "@/lib/sponsor-import";
import { xlsxToText } from "@/lib/xlsx";
import { Sheet } from "@/components/app/sheet";
import { completeTaskAction, importSponsorsAction, saveSponsorAction, startCampaignAction } from "@/app/actions/sponsoring";

export type SponsorStatus = "NONE" | "REQUESTED" | "REMINDED" | "CONFIRMED" | "DECLINED";
export type SponsorRow = {
  id: string; name: string; contact: string; hasEmail: boolean; ownerId: string; owner: string;
  status: SponsorStatus; queued: boolean; amount: number; runningUntil: number | null; billed: number; paid: number;
};
type Task = { id: string; title: string; sponsorId: string; sponsor: string; assigneeId: string; assignee: string; createdAt: string };

export const STATUS: Record<SponsorStatus, [string, string]> = {
  NONE: ["nicht angefragt", "bg-bg text-ink-2"],
  REQUESTED: ["angefragt", "bg-brand-tint text-brand-deep"],
  REMINDED: ["erinnert", "bg-warn-bg text-warn"],
  CONFIRMED: ["zugesagt", "bg-ok-bg text-ok"],
  DECLINED: ["abgesagt", "bg-bad-bg text-bad"],
};
export const pill = "inline-flex min-h-10 items-center justify-center rounded-full px-3.5 py-2 text-[13px] font-bold";
export const field = "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";
export const fieldLabel = "block text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";

export function SponsorNav({ slug, active, year }: { slug: string; active: "" | "katalog" | "rechnungen"; year: number }) {
  const base = `/c/${slug}/admin/sponsoring`;
  return (
    <nav aria-label="Sponsoring" className="flex flex-wrap items-center gap-2 px-5 pt-4">
      {([["", "Übersicht"], ["katalog", "Katalog"], ["rechnungen", "Rechnungen"]] as const).map(([k, l]) => (
        <Link key={k} href={`${base}${k ? `/${k}` : ""}?jahr=${year}`} aria-current={active === k ? "page" : undefined}
          className={cn(pill, active === k ? "bg-ink text-card" : "bg-card text-ink shadow-card")}>{l}</Link>
      ))}
      <span className="ml-auto flex items-center gap-1">
        <Link href={`${base}${active ? `/${active}` : ""}?jahr=${year - 1}`} aria-label="Vorjahr" className={cn(pill, "bg-card shadow-card")}>‹</Link>
        <b className="px-2 text-[15px] tabular-nums">{year}</b>
        <Link href={`${base}${active ? `/${active}` : ""}?jahr=${year + 1}`} aria-label="Folgejahr" className={cn(pill, "bg-card shadow-card")}>›</Link>
      </span>
    </nav>
  );
}

export function AdminSponsoring(p: {
  slug: string; year: number; meId: string; sample: boolean; rows: SponsorRow[];
  totals: { committed: number; billed: number; paid: number; renewal: number | null; prevCount: number };
  campaign: { startedAt: string; reminderDays: number; taskDays: number } | null;
  board: { id: string; name: string }[]; tasks: Task[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SponsorStatus | "ALL">("ALL");
  const [owner, setOwner] = useState("");
  const [mine, setMine] = useState(false);
  const [sheet, setSheet] = useState<"" | "new" | "import" | "campaign">("");
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: p.rows.length };
    for (const r of p.rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [p.rows]);
  const list = p.rows.filter((r) =>
    (status === "ALL" || r.status === status) && (!owner || r.ownerId === owner) &&
    (!q || `${r.name} ${r.contact}`.toLowerCase().includes(q.toLowerCase())));
  const byOwner = useMemo(() => {
    const m = new Map<string, { name: string; total: number; yes: number; open: number; no: number; amount: number }>();
    for (const r of p.rows) {
      const k = r.ownerId || "-";
      const o = m.get(k) ?? { name: r.owner || "Niemand zugeteilt", total: 0, yes: 0, open: 0, no: 0, amount: 0 };
      o.total++;
      if (r.status === "CONFIRMED") o.yes++;
      else if (r.status === "DECLINED") o.no++;
      else o.open++;
      o.amount += r.amount;
      m.set(k, o);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [p.rows]);
  const tasks = mine ? p.tasks.filter((t) => t.assigneeId === p.meId) : p.tasks;

  return (
    <>
      <SponsorNav slug={p.slug} active="" year={p.year} />

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 px-5 pt-4 @min-[1024px]:grid-cols-4">
        <Kpi label="Zugesagt" value={chf(p.totals.committed)} sub={`${counts.CONFIRMED ?? 0} Sponsoren`} hero />
        <Kpi label="Verrechnet" value={chf(p.totals.billed)} sub={p.totals.committed > p.totals.billed ? `${chf(p.totals.committed - p.totals.billed)} noch nicht` : "alles verrechnet"} />
        <Kpi label="Bezahlt" value={chf(p.totals.paid)} sub={p.totals.billed > p.totals.paid ? `${chf(p.totals.billed - p.totals.paid)} offen` : "nichts offen"} />
        <Kpi label="Verlängerungsquote" value={p.totals.renewal == null ? "–" : `${Math.round(p.totals.renewal * 100)} %`} sub={`von ${p.totals.prevCount} Sponsoren ${p.year - 1}`} />
      </section>

      {p.tasks.length > 0 && (
        <section className="card mx-5 mt-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">Aufgaben <span className="text-ink-3">{tasks.length}</span></h2>
            <button type="button" aria-pressed={mine} onClick={() => setMine(!mine)} className={cn(pill, mine ? "bg-ink text-card" : "bg-bg text-ink")}>Nur meine</button>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/c/${p.slug}/admin/sponsoring/${t.sponsorId}`} className="font-semibold">{t.sponsor}</Link>
                  <div className="text-[13.5px] text-ink-2">{t.title}{t.assignee ? ` · ${t.assignee}` : ""}</div>
                </div>
                <button type="button" disabled={pending} onClick={() => start(async () => {
                  const r = await completeTaskAction(p.slug, t.id);
                  if (r.success) router.refresh(); else toast.error(r.error);
                })} className={cn(pill, "bg-bg text-ink")}>Erledigt</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-5 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[22px] font-bold tracking-[-.02em]">Sponsoren</h2>
          <button type="button" onClick={() => setSheet("import")} className={cn(pill, "bg-card text-ink shadow-card")}>Excel importieren</button>
          <button type="button" onClick={() => setSheet("new")} className={cn(pill, "bg-brand-deep text-white")}>+ Sponsor</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma oder Kontakt suchen" aria-label="Suchen"
            className="h-[42px] min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-[15px] outline-none focus-visible:border-clay" />
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Verantwortlich" className="h-[42px] rounded-full border border-border bg-card px-3 text-[14px]">
            <option value="">Alle Verantwortlichen</option>
            {p.board.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(["ALL", "NONE", "REQUESTED", "REMINDED", "CONFIRMED", "DECLINED"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className="chip">
              {s === "ALL" ? "Alle" : STATUS[s][0]} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <ul className="card mt-3 divide-y divide-line">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/c/${p.slug}/admin/sponsoring/${r.id}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.name}</div>
                  <div className="truncate text-[13px] text-ink-2">
                    {[r.contact, r.owner && `↳ ${r.owner}`, !r.hasEmail && "keine E-Mail", r.queued && "Mail in Warteschlange", r.runningUntil && `Vertrag bis ${r.runningUntil}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {r.amount > 0 && <span className="hidden text-[14px] tabular-nums text-ink-2 sm:inline">{chf(r.amount)}</span>}
                <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold", STATUS[r.status][1])}>{STATUS[r.status][0]}</span>
              </Link>
            </li>
          ))}
          {!list.length && <li className="px-4 py-6 text-center text-[14px] text-ink-3">{p.rows.length ? "Keine Treffer." : "Noch keine Sponsoren. Importieren Sie Ihre Excel-Liste oder erfassen Sie den ersten Sponsor."}</li>}
        </ul>
      </section>

      <section className="card mx-5 mt-6 flex flex-col items-start gap-3 p-5 @min-[640px]:flex-row @min-[640px]:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">Kampagne {p.year}</h2>
          <p className="text-[14px] text-ink-2">
            {p.campaign
              ? `Gestartet am ${new Date(p.campaign.startedAt).toLocaleDateString("de-CH")}. Erinnerung alle ${p.campaign.reminderDays} Tage (max. 2), nach ${p.campaign.taskDays} Tagen ohne Antwort eine Aufgabe für die zuständige Person.`
              : "Noch nicht gestartet. Laufende Verträge werden automatisch verrechnet, alle anderen bekommen ihren persönlichen Link per E-Mail."}
          </p>
        </div>
        <button type="button" onClick={() => setSheet("campaign")} className={cn(pill, p.campaign ? "bg-bg text-ink" : "bg-brand-deep text-white")}>
          {p.campaign ? "Neue Sponsoren anfragen" : `Kampagne ${p.year} starten`}
        </button>
      </section>

      <details className="card mx-5 mt-4 overflow-x-auto p-5">
        <summary className="cursor-pointer text-[17px] font-bold">Pro Verantwortlichem <span className="text-[13px] font-normal text-ink-3">· Name antippen filtert die Liste</span></summary>
        <table className="mt-2 w-full min-w-[480px] text-[14px]">
          <thead className="text-left text-[12px] uppercase tracking-[.06em] text-ink-3">
            <tr><th className="py-1.5 font-bold">Person</th><th className="font-bold">Sponsoren</th><th className="font-bold">Zugesagt</th><th className="font-bold">Offen</th><th className="font-bold">Abgesagt</th><th className="text-right font-bold">Betrag</th></tr>
          </thead>
          <tbody>
            {byOwner.map(([id, o]) => (
              <tr key={id} className="border-t border-line">
                <td className="py-2"><button type="button" onClick={() => setOwner(owner === id ? "" : id)} className="font-semibold text-left">{o.name}</button></td>
                <td className="tabular-nums">{o.total}</td><td className="tabular-nums text-ok">{o.yes}</td><td className="tabular-nums">{o.open}</td><td className="tabular-nums">{o.no}</td>
                <td className="text-right tabular-nums">{chf(o.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <NewSponsorSheet open={sheet === "new"} onClose={() => setSheet("")} slug={p.slug} board={p.board} meId={p.meId} />
      <ImportSheet open={sheet === "import"} onClose={() => setSheet("")} slug={p.slug} year={p.year - 1} />
      <CampaignSheet sample={p.sample} open={sheet === "campaign"} onClose={() => setSheet("")} slug={p.slug} year={p.year} campaign={p.campaign} rows={p.rows} />
    </>
  );
}

function Kpi({ label, value, sub, hero }: { label: string; value: string; sub: string; hero?: boolean }) {
  return (
    <div className={cn("card flex flex-col gap-1 p-4", hero && "bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_70%)] text-white")}>
      <span className={cn("text-[13px] font-semibold", hero ? "text-white/85" : "text-ink-3")}>{label}</span>
      <b className="text-[22px] font-bold leading-tight tracking-[-.03em] tabular-nums @min-[640px]:text-[26px]">{value}</b>
      <small className={cn("text-[12.5px]", hero ? "text-white/85" : "text-ink-3")}>{sub}</small>
    </div>
  );
}

function NewSponsorSheet({ open, onClose, slug, board, meId }: { open: boolean; onClose: () => void; slug: string; board: { id: string; name: string }[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Neuer Sponsor">
      <form action={(fd) => start(async () => {
        const r = await saveSponsorAction(slug, {
          name: String(fd.get("name") ?? ""), ownerId: String(fd.get("ownerId") ?? ""),
          contacts: [{ name: String(fd.get("contact") ?? ""), email: String(fd.get("email") ?? ""), isPrimary: true }],
        });
        if (!r.success) return void toast.error(r.error);
        onClose();
        router.push(`/c/${slug}/admin/sponsoring/${r.id}`);
      })} className="grid gap-4">
        <label className={fieldLabel}>Firma<input name="name" required maxLength={120} className={field} /></label>
        <label className={fieldLabel}>Kontaktperson<input name="contact" maxLength={120} className={field} /></label>
        <label className={fieldLabel}>E-Mail<input name="email" type="email" maxLength={200} className={field} /></label>
        <label className={fieldLabel}>Zuständig bei uns
          <select name="ownerId" defaultValue={board.some((b) => b.id === meId) ? meId : ""} className={field}>
            <option value="">Niemand</option>
            {board.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <button disabled={pending} className="btn btn-pri h-[52px] w-full">{pending ? "…" : "Erfassen"}</button>
      </form>
    </Sheet>
  );
}

function ImportSheet({ open, onClose, slug, year }: { open: boolean; onClose: () => void; slug: string; year: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [listYear, setListYear] = useState(year);
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState("");
  const { rows, errors } = useMemo(() => parseSponsors(text), [text]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const buf = await f.arrayBuffer();
    try {
      if (/\.xlsx$/i.test(f.name)) return setText(await xlsxToText(buf));
      try { setText(new TextDecoder("utf-8", { fatal: true }).decode(buf)); } catch { setText(new TextDecoder("windows-1252").decode(buf)); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Datei nicht lesbar.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Sponsoren importieren">
      <div className="text-[24px] font-bold tracking-[-.03em]">Excel-Liste importieren</div>
      <p className="mt-1 text-[14px] text-muted-foreground">
        .xlsx oder CSV wählen, oder Zellen aus Excel einfügen. Erkannte Spalten: Firma, Kontakt, E-Mail, Telefon, Strasse, PLZ, Ort, Website, Verantwortlich, Leistung, Betrag, Jahr, Bemerkung.
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Tipp: zuerst den Katalog erfassen. Leistungen mit gleichem Namen werden als Wahl des Jahres übernommen, damit das Portal «Ihre Wahl {listYear}» zeigt. Gleiche Firma = wird ergänzt, nicht doppelt angelegt.
      </p>
      <label className="btn btn-ghost mt-3 w-full cursor-pointer">Datei wählen<input type="file" accept=".xlsx,.csv,.txt" onChange={pick} className="sr-only" /></label>
      <textarea aria-label="Sponsorenliste" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Firma;Kontakt;E-Mail;Leistung;Betrag"
        className="mt-3 w-full rounded-[15px] border border-border bg-inset p-3 font-mono text-[13px] outline-none focus-visible:border-clay" />
      <label className={cn(fieldLabel, "mt-3")}>Jahr der Liste (wenn keine Spalte «Jahr»)
        <input type="number" value={listYear} onChange={(e) => setListYear(Number(e.target.value))} className={field} />
      </label>
      {text && (
        <p className="mt-3 text-[14px]">
          <b>{rows.length}</b> Sponsoren erkannt{errors.length > 0 && <span className="text-warn"> · {errors.length} Hinweise: {errors.slice(0, 4).map((e) => `Zeile ${e.line}: ${e.reason}`).join("; ")}</span>}
        </p>
      )}
      {summary && <p className="mt-2 rounded-[14px] bg-ok-bg p-3 text-[14px] text-ok">{summary}</p>}
      <button type="button" disabled={!rows.length || pending} className="btn btn-pri mt-4 h-[52px] w-full" onClick={() => start(async () => {
        const r = await importSponsorsAction(slug, text, listYear);
        if (!r.success) return void toast.error(r.error);
        const msg = `${r.created} neu, ${r.updated} ergänzt, ${r.contracts} Wahlen ${listYear} übernommen${r.unmatched.length ? `. Nicht im Katalog: ${r.unmatched.slice(0, 5).join(", ")}` : ""}`;
        setSummary(msg);
        toast.success("Import fertig");
        router.refresh();
      })}>{pending ? "Importiere …" : `${rows.length} importieren`}</button>
    </Sheet>
  );
}

function CampaignSheet({ sample, open, onClose, slug, year, campaign, rows }: {
  sample: boolean; open: boolean; onClose: () => void; slug: string; year: number;
  campaign: { reminderDays: number; taskDays: number } | null; rows: SponsorRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const running = rows.filter((r) => r.status === "CONFIRMED").length;
  const ask = rows.filter((r) => r.status === "NONE").length;
  const noMail = rows.filter((r) => r.status === "NONE" && !r.hasEmail).length;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`Kampagne ${year}`}>
      <div className="text-[24px] font-bold tracking-[-.03em]">{campaign ? "Neue Sponsoren anfragen" : `Kampagne ${year} starten`}</div>
      <ul className="mt-3 grid gap-1.5 text-[14.5px]">
        <li><b>{ask}</b> Sponsoren bekommen jetzt ihren persönlichen Link per E-Mail{noMail ? ` (${noMail} ohne E-Mail → Aufgabe für die zuständige Person)` : ""}.</li>
        <li><b>{running}</b> haben schon zugesagt oder einen laufenden Vertrag: keine Anfrage, die Rechnung geht automatisch raus.</li>
        <li>Wer nicht antwortet, wird automatisch erinnert. Danach bekommt die zuständige Person eine Aufgabe.</li>
      </ul>
      {sample && <SampleWarning slug={slug} />}
      {ask - noMail > 0 && (
        <div role="alert" className="mt-4 rounded-[14px] bg-warn-bg p-3 text-[14px] text-warn">
          <b>Achtung:</b> Beim Starten gehen sofort <b>{ask - noMail} E-Mails</b> an die Sponsoren raus, danach automatisch die Erinnerungen. Das lässt sich nicht rückgängig machen. Bitte vorher Katalog, Preise und Kontakte prüfen.
        </div>
      )}
      <form action={(fd) => start(async () => {
        if (ask - noMail > 0 && !window.confirm(`Jetzt ${ask - noMail} E-Mails an Sponsoren verschicken?`)) return;
        const r = await startCampaignAction(slug, year, Number(fd.get("reminderDays")), Number(fd.get("taskDays")));
        if (!r.success) return void toast.error(r.error);
        toast.success(r.summary);
        onClose();
        router.refresh();
      })} className="mt-4 grid grid-cols-2 gap-3">
        <label className={fieldLabel}>Erinnern nach (Tagen)<input name="reminderDays" type="number" min={3} max={60} defaultValue={campaign?.reminderDays ?? 14} className={field} /></label>
        <label className={fieldLabel}>Aufgabe nach (Tagen)<input name="taskDays" type="number" min={4} max={120} defaultValue={campaign?.taskDays ?? 35} className={field} /></label>
        <button disabled={pending} className="btn btn-pri col-span-2 h-[52px] w-full">{pending ? "Mails werden verschickt …" : campaign ? "Anfragen" : "Starten und Mails verschicken"}</button>
      </form>
    </Sheet>
  );
}

export function SampleWarning({ slug }: { slug: string }) {
  return (
    <p role="alert" className="mt-3 rounded-[14px] bg-bad-bg p-3 text-[14px] text-bad">
      <b>IBAN oder Clubadresse fehlt.</b> Rechnungen werden erst verschickt, wenn beides erfasst ist.{" "}
      <Link href={`/c/${slug}/admin/settings/zahlungen#rechnungsdaten`} className="font-bold underline">Jetzt ergänzen ›</Link>
    </p>
  );
}
