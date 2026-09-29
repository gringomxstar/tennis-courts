"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, Spinner } from "@/components/app/avatar";
import { Sheet } from "@/components/app/sheet";
import { sendPaymentReminderAction } from "@/actions/admin-billing";
import {
  importMembersAction, markMembershipPaidAction, removeMemberAction, renewMembershipAction, saveMemberAction, sendRenewalRemindersAction, type MemberInput,
} from "@/app/actions/club-settings";
import { parseMembers } from "@/lib/member-import";
import type { TenantRole } from "@/types";
import { initials } from "@/lib/courts";
import { cn } from "@/lib/utils";

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  plan: string;
  /** paid = ACTIVE membership, invoice = PENDING offline invoice, remind = anything else */
  state: "paid" | "invoice" | "remind";
  stripeCustomerId: string | null;
  role: TenantRole;
  phone: string;
  birthDate: string;
  gender: string;
  /** current ACTIVE/PENDING plan */
  planId: string;
  /** most relevant membership (active first), empty when none */
  planStatus: "ACTIVE" | "PENDING" | "EXPIRED" | "CANCELLED" | null;
  planStart: string;
  planEnd: string;
  paidAt: string;
  pricePaid: number | null;
  /** end of the already booked next season, empty when not renewed */
  renewedUntil: string;
  /** renewal is an open invoice */
  renewalOpen: boolean;
  /** manual money decisions about this member, newest first (audit log) */
  history: { at: string; text: string; by: string }[];
}

export interface PlanOption {
  id: string;
  name: string;
  price: number;
  ageMin: number | null;
  ageMax: number | null;
  proofRequired: boolean;
}

const ROLES: [TenantRole, string][] = [
  ["MEMBER", "Mitglied"],
  ["COACH", "Trainer"],
  ["GUEST", "Gast"],
  ["CLUB_ADMIN", "Admin"],
];

const pill = "rounded-full px-3.5 py-2 text-[13px] font-bold";
const DAY = 86_400_000;
const date = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Zurich" });
const daysLeft = (m: MemberRow) => (m.planId && m.planEnd ? Math.ceil((Date.parse(m.planEnd) - Date.now()) / DAY) : null);
const unpaid = (m: MemberRow) => m.state === "invoice" || m.renewalOpen;
const STATUS: Record<NonNullable<MemberRow["planStatus"]>, string> = { ACTIVE: "Aktiv", PENDING: "Rechnung offen", EXPIRED: "Abgelaufen", CANCELLED: "Beendet" };

/** What the club has to verify for the current Abo: age range (by birth year, like Swiss Tennis) and proofs like a student card. */
function checks(m: MemberRow, plans: PlanOption[]): string[] {
  const p = m.planId ? plans.find((x) => x.id === m.planId) : undefined;
  if (!p) return [];
  const out: string[] = [];
  if (p.ageMin != null || p.ageMax != null) {
    const age = m.birthDate ? new Date().getFullYear() - Number(m.birthDate.slice(0, 4)) : null;
    if (age === null) out.push("Geburtsdatum fehlt");
    else if ((p.ageMin != null && age < p.ageMin) || (p.ageMax != null && age > p.ageMax)) {
      out.push(`Alter ${age} ausserhalb ${p.ageMin ?? 0}–${p.ageMax ?? "∞"}`);
    }
  }
  if (p.proofRequired) out.push("Ausweis prüfen");
  return out;
}

/** Excel-friendly CSV (";" + BOM) of the given rows. */
function downloadCsv(rows: MemberRow[]) {
  const d = (iso: string) => (iso ? date(iso) : "");
  // a leading = + - @ would run as a formula in Excel
  const cell = (v: unknown) => `"${String(v ?? "").replace(/^([=+\-@])/, "'$1").replaceAll('"', '""')}"`;
  const lines = [
    ["Name", "E-Mail", "Telefon", "Geburtsdatum", "Rolle", "Abo", "Status", "Von", "Bis", "Verlängert bis", "Bezahlt am", "CHF"],
    ...rows.map((m) => [
      m.name, m.email, m.phone, m.birthDate, ROLES.find(([r]) => r === m.role)?.[1] ?? m.role,
      m.planId ? m.plan : "", m.planStatus ? STATUS[m.planStatus] : "", d(m.planStart), d(m.planEnd), d(m.renewedUntil), d(m.paidAt), m.pricePaid ?? "",
    ]),
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.map((r) => r.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  a.download = `mitglieder-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** "bis 31.3.2027" with a warning tone near/after the end. */
function Validity({ m }: { m: MemberRow }) {
  const d = daysLeft(m);
  if (d === null) return <span className="text-muted-foreground">–</span>;
  if (m.renewedUntil) {
    return <span className="text-paid-fg">verlängert bis {date(m.renewedUntil)}{m.renewalOpen ? " · offen" : ""}</span>;
  }
  return (
    <span className={cn(d < 0 ? "text-destructive" : d <= 30 ? "text-amber-600" : "text-muted-foreground")}>
      bis {date(m.planEnd)}
      {d < 0 ? " · abgelaufen" : d <= 30 ? ` · noch ${d} T.` : ""}
    </span>
  );
}

type FilterId = "all" | "abo" | "none" | "open" | "soon" | "check";
const filtersFor = (plans: PlanOption[]): [FilterId, string, (m: MemberRow) => boolean][] => [
  ["all", "Alle", () => true],
  ["abo", "Mit Abo", (m) => Boolean(m.planId)],
  ["none", "Ohne Abo", (m) => !m.planId],
  ["open", "Unbezahlt", unpaid],
  ["soon", "Läuft ab", (m) => !m.renewedUntil && (daysLeft(m) ?? Infinity) <= 30],
  ["check", "Prüfen", (m) => checks(m, plans).length > 0],
];

export function AdminMembers({ slug, tenantId, members, plans }: { slug: string; tenantId: string; members: MemberRow[]; plans: PlanOption[] }) {
  const [editing, setEditing] = useState<MemberRow | "new" | null>(null);
  const router = useRouter();
  const [reminded, setReminded] = useState<string[]>([]);
  const [paid, setPaid] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sel, setSel] = useState<string[]>([]);
  const filters = useMemo(() => filtersFor(plans), [plans]);
  const needle = q.trim().toLowerCase();
  const test = filters.find(([id]) => id === filter)![2];
  const shown = members.filter((m) => test(m) && (!needle || `${m.name} ${m.email} ${m.plan}`.toLowerCase().includes(needle)));
  const picked = members.filter((m) => sel.includes(m.id));
  const allOn = shown.length > 0 && shown.every((m) => sel.includes(m.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // newest open invoice → ACTIVE via grantMembership (price snapshot, starts after a running Abo)
  const payOne = (m: MemberRow) => markMembershipPaidAction(slug, m.id);

  async function markPaid(m: MemberRow) {
    if (busy) return;
    setBusy(m.id);
    const res = await payOne(m);
    setBusy(null);
    if (!res.success) {
      toast.error(res.error || "Rechnung konnte nicht als bezahlt markiert werden.");
      return;
    }
    setPaid((p) => [...p, m.id]);
    router.refresh();
  }

  async function remind(m: MemberRow) {
    if (busy) return;
    setBusy(m.id);
    const res = await sendPaymentReminderAction(tenantId, m.id);
    setBusy(null);
    if (!res.success) {
      toast.error(res.error || "Erinnerung konnte nicht gesendet werden.");
      return;
    }
    setReminded((r) => [...r, m.id]);
    toast("Zahlungserinnerung gesendet");
  }

  /** Runs one action per selected member, one after another, and reports the count. */
  async function bulk(kind: "remind" | "paid" | "renew") {
    if (busy) return;
    setBusy("bulk");
    let ok = 0;
    if (kind === "renew") {
      const res = await sendRenewalRemindersAction(slug, picked.filter((m) => m.planId).map((m) => m.id)).catch(() => null);
      ok = res?.success ? res.sent : 0;
    } else {
      const targets = kind === "paid" ? picked.filter(unpaid) : picked.filter((m) => m.state !== "paid" && m.role !== "CLUB_ADMIN" && m.role !== "COACH");
      for (const m of targets) {
        const res = await (kind === "paid" ? payOne(m) : sendPaymentReminderAction(tenantId, m.id)).catch(() => null);
        if (res?.success) ok++;
      }
    }
    setBusy(null);
    toast(`${ok} von ${picked.length}: ${{ remind: "Zahlungserinnerung gesendet", paid: "als bezahlt markiert", renew: "Verlängerungs-Mail gesendet" }[kind]}`);
    setSel([]);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2.5 px-5 pt-4">
        <input
          type="search"
          aria-label="Mitglieder suchen"
          placeholder={`Suchen in ${members.length} Mitgliedern`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-[50px] min-w-0 flex-1 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-clay lg:max-w-[480px]"
        />
        <button type="button" onClick={() => setEditing("new")} className="h-[50px] shrink-0 rounded-[15px] bg-clay px-4 text-[15px] font-bold text-white">
          + Mitglied
        </button>
        <button type="button" onClick={() => downloadCsv(shown)} className="hidden h-[50px] shrink-0 rounded-[15px] border border-border px-4 text-[15px] font-bold sm:block">
          Export
        </button>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3">
        {filters.map(([id, label, t]) => {
          const on = filter === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(id)}
              className={cn(
                "flex-none rounded-full border px-4 py-2 text-[14px] font-semibold",
                on ? "border-foreground bg-foreground text-background" : "border-border text-foreground"
              )}
            >
              {label} <span className="opacity-60">{members.filter(t).length}</span>
            </button>
          );
        })}
      </div>
      <MemberSheet slug={slug} plans={plans} member={editing} onClose={() => setEditing(null)} />
      {/* desktop: scannable table; mobile: the same rows stack as cards */}
      <div className={cn("flex flex-col gap-2 px-5 pt-3 lg:mx-5 lg:mt-3 lg:gap-0 lg:overflow-hidden lg:rounded-[20px] lg:border lg:border-border lg:bg-card lg:px-0 lg:pt-0", picked.length > 0 && "mb-24")}>
        <div className="hidden grid-cols-[24px_minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_150px] gap-4 border-b border-border px-5 py-3 text-[12px] font-bold uppercase tracking-[.06em] text-muted-foreground lg:grid">
          <input
            type="checkbox"
            aria-label="Alle angezeigten auswählen"
            checked={allOn}
            onChange={() => setSel(allOn ? [] : shown.map((m) => m.id))}
            className="h-[18px] w-[18px] accent-clay"
          />
          <span>Mitglied</span>
          <span>Abo</span>
          <span>Gültigkeit</span>
          <span className="text-right">Zahlung</span>
        </div>
        {!shown.length && <div className="py-6 text-center text-[15px] text-muted-foreground">Niemand gefunden</div>}
        {shown.map((m) => {
          const isPaid = m.state === "paid" || paid.includes(m.id);
          const sent = reminded.includes(m.id);
          const role = m.role !== "MEMBER" ? ROLES.find(([r]) => r === m.role)?.[1] : null;
          const warn = checks(m, plans);
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3 lg:grid lg:grid-cols-[24px_minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_150px] lg:gap-4 lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:last:border-b-0 lg:hover:bg-inset/50"
            >
              <input
                type="checkbox"
                aria-label={`${m.name} auswählen`}
                checked={sel.includes(m.id)}
                onChange={() => toggle(m.id)}
                className="h-[18px] w-[18px] shrink-0 accent-clay"
              />
              <button type="button" onClick={() => setEditing(m)} aria-label={`${m.name} bearbeiten`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar ini={initials(m.name)} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[16px] font-bold underline-offset-2 hover:underline">{m.name}</span>
                    {role && <span className="shrink-0 rounded-full bg-inset px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.04em] text-muted-foreground">{role}</span>}
                    {warn.length > 0 && (
                      <span title={warn.join(" · ")} className="shrink-0 rounded-full bg-amber-100 max-sm:hidden px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        {warn.length === 1 ? warn[0] : `${warn.length} prüfen`}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">{m.email}</span>
                  {/* mobile: Abo + validity under the name */}
                  <span className="block truncate text-[13px] lg:hidden">
                    {m.planId ? <><b className="font-semibold">{m.plan}</b> · <Validity m={m} /></> : <span className="text-muted-foreground">Kein Abo</span>}
                    {warn.length > 0 && <span className="font-semibold text-amber-700 sm:hidden"> · ⚠ {warn[0]}</span>}
                  </span>
                </span>
              </button>
              <div className="hidden min-w-0 lg:block">
                {m.planId ? (
                  <>
                    <div className="truncate text-[15px] font-semibold">{m.plan}</div>
                    {m.pricePaid != null && <div className="text-[13px] text-muted-foreground">CHF {m.pricePaid}</div>}
                  </>
                ) : (
                  <span className="text-[15px] text-muted-foreground">Kein Abo</span>
                )}
              </div>
              <div className="hidden text-[14px] lg:block">
                <Validity m={m} />
                {m.planId && m.planStart && <div className="text-[12px] text-muted-foreground">seit {date(m.planStart)}</div>}
              </div>
              <div className="shrink-0 lg:flex lg:justify-end">
                {m.renewalOpen && !paid.includes(m.id) ? (
                  <button type="button" onClick={() => markPaid(m)} disabled={busy === m.id} aria-label={`Verlängerung von ${m.name} als bezahlt markieren`} className={cn(pill, "bg-clay text-white")}>
                    Bezahlt markieren
                  </button>
                ) : isPaid ? (
                  <span className={cn(pill, "bg-paid-bg text-paid-fg")}>Bezahlt</span>
                ) : m.state === "invoice" ? (
                  <button
                    type="button"
                    onClick={() => markPaid(m)}
                    disabled={busy === m.id}
                    aria-label={`Rechnung von ${m.name} als bezahlt markieren`}
                    className={cn(pill, "bg-clay text-white")}
                  >
                    Bezahlt markieren
                  </button>
                ) : m.role === "CLUB_ADMIN" || m.role === "COACH" ? null : sent ? (
                  <span className={cn(pill, "bg-inset text-muted-foreground")}>Gesendet</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => remind(m)}
                    disabled={busy === m.id}
                    aria-label={`Zahlungserinnerung an ${m.name} senden`}
                    className={cn(pill, "border border-border text-foreground")}
                  >
                    Erinnern
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {picked.length > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(max(10px,env(safe-area-inset-bottom))+84px)] z-40 mx-auto flex max-w-[720px] flex-wrap items-center gap-2 rounded-[20px] border border-border bg-card p-2.5 shadow-lg lg:bottom-6 lg:left-64">
          <span className="px-2 text-[14px] font-bold">{picked.length} ausgewählt</span>
          <div className="flex-1" />
          <button type="button" disabled={busy === "bulk"} onClick={() => bulk("remind")} className={cn(pill, "border border-border")}>Erinnern</button>
          <button type="button" disabled={busy === "bulk"} onClick={() => bulk("paid")} className={cn(pill, "border border-border")}>Bezahlt</button>
          <button type="button" disabled={busy === "bulk"} onClick={() => bulk("renew")} className={cn(pill, "border border-border")}>Verlängerung anbieten</button>
          <button type="button" onClick={() => downloadCsv(picked)} className={cn(pill, "border border-border")}>CSV</button>
          <button type="button" onClick={() => setSel([])} aria-label="Auswahl aufheben" className={cn(pill, "bg-inset")}>
            {busy === "bulk" ? <Spinner /> : "✕"}
          </button>
        </div>
      )}
    </>
  );
}

/** "Importieren" button + sheet: paste from Excel or pick a CSV, live preview, then import. */
export function ImportMembers({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [invite, setInvite] = useState(true);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const { rows, errors } = useMemo(() => parseMembers(text), [text]);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Excel/Fairgate CSVs are often Windows-1252, not UTF-8
    const buf = await file.arrayBuffer();
    try {
      setText(new TextDecoder("utf-8", { fatal: true }).decode(buf));
    } catch {
      setText(new TextDecoder("windows-1252").decode(buf));
    }
    e.target.value = "";
  }

  async function run() {
    if (!rows.length || pending) return;
    setPending(true);
    setSummary(null);
    const res = await importMembersAction(slug, text, invite).catch(() => null);
    setPending(false);
    if (!res?.success) {
      toast.error(res?.error ?? "Import fehlgeschlagen.");
      return;
    }
    const parts = [`${res.created} neu`, `${res.updated} aktualisiert`, `${res.unchanged} unverändert`];
    if (invite) parts.push(`${res.invited} eingeladen`);
    if (res.inviteFailed) parts.push(`${res.inviteFailed} Mails fehlgeschlagen`);
    if (res.invitesSkipped) parts.push(`${res.invitesSkipped} Einladungen übersprungen (Tageslimit)`);
    if (res.abos) parts.push(`${res.abos} Abos freigeschaltet`);
    if (res.aboErrors.length) parts.push(`${res.aboErrors.length} Abos nicht gefunden: ${res.aboErrors.slice(0, 3).join(", ")}`);
    const msg = parts.join(" · ");
    setSummary(msg);
    toast(`Import fertig: ${msg}`);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(pill, "shrink-0 bg-inset text-foreground")}>
        Importieren
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Mitglieder importieren">
        <div className="text-[28px] font-bold tracking-[-.03em]">Mitglieder importieren</div>
        <div className="mt-1 text-[14px] text-muted-foreground">
          Aus Excel kopieren und einfügen oder CSV wählen. Spalten: Vorname, Nachname, E-Mail, Telefon, optional Geburtsdatum, Geschlecht, Abo (Name wie unter Abos & Tarife → gilt als bezahlt)
        </div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          <b className="font-bold text-foreground">Fairgate:</b> Kontakte filtern (z.B. Mitglieder) → Export → CSV. Die Fairgate-Spalten werden automatisch erkannt.
        </div>
        <textarea
          aria-label="Mitgliederliste"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={"Vorname;Nachname;E-Mail;Telefon\nHans;Muster;hans@example.ch;079 123 45 67"}
          className="mt-[14px] w-full resize-y rounded-[18px] border border-border bg-inset px-4 py-3 font-mono text-[13px] text-foreground outline-none focus-visible:border-clay"
        />
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[14px] font-bold text-clay-text">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          CSV-Datei wählen
          <input type="file" accept=".csv,.txt,text/csv" onChange={pickFile} className="sr-only" />
        </label>

        {text.trim() && (
          <div className="mt-[14px] rounded-[18px] border border-border bg-card px-4 py-3">
            <div className="text-[15px] font-bold">
              {rows.length} gültig · {errors.length} Fehler
            </div>
            {errors.slice(0, 5).map((e) => (
              <div key={e.line} className="text-[13px] text-clay-text">
                Zeile {e.line} – {e.reason}
              </div>
            ))}
            {errors.length > 5 && <div className="text-[13px] text-muted-foreground">und {errors.length - 5} weitere</div>}
            {rows.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                {rows.slice(0, 5).map((r) => (
                  <li key={r.email} className="flex gap-2 text-[13px]">
                    <span className="shrink-0 font-bold">
                      {r.firstName} {r.lastName}
                    </span>
                    <span className="min-w-0 truncate text-muted-foreground">{r.email}</span>
                    {r.birthDate && <span className="shrink-0 text-muted-foreground">{r.birthDate.slice(0, 4)}</span>}
                    {r.plan && <span className="shrink-0 font-semibold">{r.plan}</span>}
                  </li>
                ))}
                {rows.length > 5 && <li className="text-[13px] text-muted-foreground">und {rows.length - 5} weitere</li>}
              </ul>
            )}
          </div>
        )}

        <label className="mt-[14px] flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={invite}
            onChange={(e) => setInvite(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-clay"
          />
          <span>
            <span className="block text-[15px] font-bold">Einladungs-Mail senden</span>
            <span className="block text-[13px] text-muted-foreground">
              Nur an Mitglieder ohne Passwort, max. 250 pro Tag
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={run}
          disabled={!rows.length || pending}
          className="mt-4 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[20px] bg-clay text-[18px] font-bold text-white active:scale-[.97] disabled:opacity-40 disabled:active:scale-100"
        >
          {pending && <Spinner />}
          {pending ? "Importiere…" : `${rows.length} ${rows.length === 1 ? "Mitglied" : "Mitglieder"} importieren`}
        </button>
        {summary && (
          <div role="status" className="mt-3 text-center text-[14px] text-muted-foreground">
            {summary}
          </div>
        )}
      </Sheet>
    </>
  );
}

const field = "mt-1.5 h-[50px] w-full min-w-0 rounded-[15px] border border-border bg-inset px-4 text-[16px] text-foreground outline-none focus-visible:border-clay";
const fieldLabel = "block text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";

/** Add or edit one member: profile, role, Abo, remove from club. */
function MemberSheet({ slug, plans, member, onClose }: { slug: string; plans: PlanOption[]; member: MemberRow | "new" | null; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<MemberInput | null>(null);
  const [shown, setShown] = useState<MemberRow | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  if (member && member !== shown) {
    setShown(member);
    setArmed(false);
    const [first, ...rest] = member === "new" ? [""] : member.name.split(" ");
    setF(
      member === "new"
        ? { firstName: "", lastName: "", email: "", phone: "", birthDate: "", gender: "", role: "MEMBER", planId: "", paid: true, invite: true }
        : { id: member.id, firstName: first, lastName: rest.join(" "), email: member.email, phone: member.phone, birthDate: member.birthDate, gender: member.gender as MemberInput["gender"], role: member.role, planId: "", paid: true }
    );
  }
  if (!member && shown) setShown(null);
  const set = (patch: Partial<MemberInput>) => setF((x) => (x ? { ...x, ...patch } : x));
  const isNew = !f?.id;
  const current = shown && shown !== "new" ? shown : null;

  async function save() {
    if (!f || busy) return;
    setBusy(true);
    const res = await saveMemberAction(slug, f).catch(() => null);
    setBusy(false);
    if (!res?.success) return void toast.error(res?.error ?? "Speichern fehlgeschlagen.");
    toast(isNew ? "Mitglied angelegt" : "Gespeichert");
    onClose();
    router.refresh();
  }

  async function renew(paid: boolean) {
    if (!current || busy) return;
    setBusy(true);
    const res = await renewMembershipAction(slug, current.id, paid).catch(() => null);
    setBusy(false);
    if (!res?.success) return void toast.error(res?.error ?? "Verlängern fehlgeschlagen.");
    toast(paid ? "Für nächste Saison verlängert" : "Verlängert, Rechnung offen");
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!f?.id || busy) return;
    if (!armed) return setArmed(true);
    setBusy(true);
    const res = await removeMemberAction(slug, f.id).catch(() => null);
    setBusy(false);
    if (!res?.success) return void toast.error(res?.error ?? "Entfernen fehlgeschlagen.");
    toast("Aus dem Club entfernt");
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={Boolean(member)} onOpenChange={(o) => !o && onClose()} title={isNew ? "Mitglied hinzufügen" : "Mitglied bearbeiten"}>
      {f && (
        <div className="flex flex-col gap-3.5">
          <div className="text-[28px] font-bold tracking-[-.03em]">{isNew ? "Mitglied hinzufügen" : "Mitglied bearbeiten"}</div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className={fieldLabel}>Vorname</span>
              <input value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} autoComplete="off" className={field} />
            </label>
            <label className="block">
              <span className={fieldLabel}>Nachname</span>
              <input value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} autoComplete="off" className={field} />
            </label>
          </div>
          <label className="block">
            <span className={fieldLabel}>E-Mail</span>
            <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} autoComplete="off" className={field} />
          </label>
          <label className="block">
            <span className={fieldLabel}>Telefon</span>
            <input type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="off" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className={fieldLabel}>Geburtsdatum</span>
              <input type="date" value={f.birthDate} onChange={(e) => set({ birthDate: e.target.value })} className={field} />
            </label>
            <label className="block">
              <span className={fieldLabel}>Geschlecht</span>
              <select value={f.gender} onChange={(e) => set({ gender: e.target.value as MemberInput["gender"] })} className={field}>
                <option value="">–</option>
                <option value="F">weiblich</option>
                <option value="M">männlich</option>
                <option value="X">divers</option>
              </select>
            </label>
          </div>
          <div>
            <span className={fieldLabel}>Rolle</span>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Rolle">
              {ROLES.map(([r, l]) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={f.role === r}
                  onClick={() => set({ role: r })}
                  className={cn("h-11 rounded-[13px] border text-[14px] font-bold", f.role === r ? "border-clay bg-clay text-white" : "border-border bg-inset text-foreground")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={fieldLabel}>Abo</span>
            {current?.planStatus && (
              <div className="mt-1.5 rounded-[16px] border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-bold">{current.plan}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[12px] font-bold",
                      current.planStatus === "ACTIVE" ? "bg-paid-bg text-paid-fg" : current.planStatus === "PENDING" ? "bg-amber-100 text-amber-800" : "bg-inset text-muted-foreground"
                    )}
                  >
                    {STATUS[current.planStatus]}
                  </span>
                </div>
                <div className="mt-1 text-[14px] text-muted-foreground">
                  Laufzeit {current.planStart ? date(current.planStart) : "?"} – {current.planEnd ? date(current.planEnd) : "offen"}
                  {(() => {
                    const d = daysLeft(current);
                    return d === null ? null : <span className={cn(d < 0 ? "text-destructive" : d <= 30 && "text-amber-600")}> · {d < 0 ? "abgelaufen" : `noch ${d} Tage`}</span>;
                  })()}
                </div>
                {(current.paidAt || current.pricePaid != null) && (
                  <div className="text-[13px] text-muted-foreground">
                    {[current.paidAt && `Bezahlt am ${date(current.paidAt)}`, current.pricePaid != null && `CHF ${current.pricePaid}`].filter(Boolean).join(" · ")}
                  </div>
                )}
                {checks(current, plans).map((w) => (
                  <div key={w} className="mt-1.5 rounded-[10px] bg-amber-100 px-2.5 py-1.5 text-[13px] font-semibold text-amber-800">⚠ {w}</div>
                ))}
                {current.renewedUntil ? (
                  <div className="mt-2 text-[14px] font-semibold text-paid-fg">
                    Verlängert bis {date(current.renewedUntil)}{current.renewalOpen ? " · Rechnung offen" : ""}
                  </div>
                ) : current.planStatus === "ACTIVE" && (
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    <button type="button" disabled={busy} onClick={() => renew(true)} className="h-10 rounded-[12px] bg-clay text-[14px] font-bold text-white">
                      Verlängern · bezahlt
                    </button>
                    <button type="button" disabled={busy} onClick={() => renew(false)} className="h-10 rounded-[12px] border border-border text-[14px] font-bold">
                      Verlängern · Rechnung
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 text-[13px] font-semibold text-muted-foreground">{current?.planId ? "Wechseln zu" : "Abo zuweisen"}</div>
            <div className="mt-1.5 grid max-h-[260px] grid-cols-2 gap-1.5 overflow-y-auto" role="radiogroup" aria-label="Abo wählen">
              {plans.map((p) => {
                const on = f.planId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ planId: on ? "" : p.id })}
                    className={cn("rounded-[13px] border px-3 py-2.5 text-left", on ? "border-clay bg-free-tint" : "border-border bg-inset")}
                  >
                    <span className="block text-[14px] font-bold leading-tight">{p.name}</span>
                    <span className="block text-[13px] text-muted-foreground">CHF {p.price}{p.id === current?.planId ? " · aktuell" : ""}</span>
                  </button>
                );
              })}
            </div>
            {current?.planId && (
              <button
                type="button"
                aria-pressed={f.planId === "__end"}
                onClick={() => set({ planId: f.planId === "__end" ? "" : "__end" })}
                className={cn("mt-1.5 h-10 w-full rounded-[13px] border text-[14px] font-bold", f.planId === "__end" ? "border-destructive bg-destructive text-white" : "border-border text-clay-text")}
              >
                {f.planId === "__end" ? "Abo wird beim Speichern beendet" : "Abo beenden"}
              </button>
            )}
          </div>
          {f.planId && f.planId !== "__end" && (
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={Boolean(f.paid)} onChange={(e) => set({ paid: e.target.checked })} className="h-5 w-5 accent-clay" />
              <span className="text-[15px] font-bold">Bereits bezahlt (bar / Überweisung)</span>
            </label>
          )}
          {isNew && (
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={Boolean(f.invite)} onChange={(e) => set({ invite: e.target.checked })} className="h-5 w-5 accent-clay" />
              <span className="text-[15px] font-bold">Einladungs-Mail senden</span>
            </label>
          )}
          {current && current.history.length > 0 && (
            <div>
              <span className={fieldLabel}>Verlauf (manuell)</span>
              <ul className="mt-1.5 flex flex-col gap-1 rounded-[16px] border border-border bg-card px-4 py-3">
                {current.history.map((h) => (
                  <li key={h.at + h.text} className="text-[13px] leading-snug">
                    <span className="text-muted-foreground">{date(h.at)} · {h.by}: </span>
                    {h.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="mt-1 flex h-[58px] w-full items-center justify-center gap-2.5 rounded-[20px] bg-clay text-[18px] font-bold text-white active:scale-[.97] disabled:opacity-60"
          >
            {busy && <Spinner />}
            {isNew ? "Hinzufügen" : "Speichern"}
          </button>
          {!isNew && (
            <button type="button" onClick={remove} onBlur={() => setArmed(false)} disabled={busy} className="h-[50px] rounded-[17px] bg-inset text-[16px] font-bold text-clay-text">
              {armed ? "Wirklich aus dem Club entfernen?" : "Aus dem Club entfernen"}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
