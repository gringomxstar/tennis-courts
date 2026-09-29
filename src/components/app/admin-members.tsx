"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, Spinner } from "@/components/app/avatar";
import { Sheet } from "@/components/app/sheet";
import { AdminGrantCreditsButton } from "@/components/admin/admin-grant-credits-button";
import { markInvoiceAsPaidManually, sendPaymentReminderAction } from "@/actions/admin-billing";
import { importMembersAction, markMembershipPaidAction, removeMemberAction, saveMemberAction, setMemberRoleAction, type MemberInput } from "@/app/actions/club-settings";
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
}

export interface PlanOption {
  id: string;
  name: string;
  price: number;
}

const ROLES: [TenantRole, string][] = [
  ["MEMBER", "Mitglied"],
  ["COACH", "Trainer"],
  ["GUEST", "Gast"],
  ["CLUB_ADMIN", "Admin"],
];

const pill = "rounded-full px-3.5 py-2 text-[13px] font-bold";

export function AdminMembers({ slug, tenantId, members, plans }: { slug: string; tenantId: string; members: MemberRow[]; plans: PlanOption[] }) {
  const [editing, setEditing] = useState<MemberRow | "new" | null>(null);
  const router = useRouter();
  const [reminded, setReminded] = useState<string[]>([]);
  const [paid, setPaid] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle ? members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(needle)) : members;

  async function markPaid(m: MemberRow) {
    if (busy) return;
    setBusy(m.id);
    // Stripe invoices go through Stripe; Abos assigned by hand are paid cash / by transfer
    const res = m.stripeCustomerId
      ? await markInvoiceAsPaidManually(tenantId, m.id, m.stripeCustomerId)
      : await markMembershipPaidAction(slug, m.id);
    setBusy(null);
    if (!res.success) {
      toast.error(res.error || "Rechnung konnte nicht als bezahlt markiert werden.");
      return;
    }
    setPaid((p) => [...p, m.id]);
    router.refresh();
  }

  async function setRole(m: MemberRow, role: TenantRole) {
    const res = await setMemberRoleAction(slug, m.id, role);
    toast(res.success ? `${m.name}: ${ROLES.find(([r]) => r === role)?.[1]}` : (res.error ?? "Rolle nicht geändert"));
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
      </div>
      <MemberSheet slug={slug} plans={plans} member={editing} onClose={() => setEditing(null)} />
      <div className="flex flex-col gap-2.5 px-5 pt-3 lg:grid lg:grid-cols-2">
      {needle && !shown.length && <div className="py-6 text-center text-[15px] text-muted-foreground">Niemand gefunden</div>}
      {shown.map((m) => {
        const isPaid = m.state === "paid" || paid.includes(m.id);
        const sent = reminded.includes(m.id);
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5">
            <Avatar ini={initials(m.name)} />
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => setEditing(m)} aria-label={`${m.name} bearbeiten`} className="block w-full min-w-0 text-left">
                <div className="text-[16px] font-bold underline-offset-2 hover:underline">{m.name}</div>
                <div className="truncate text-[13px] text-muted-foreground">{m.email}</div>
                <div className="text-[14px] text-muted-foreground">{m.plan}</div>
              </button>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {m.role !== "PLATFORM_ADMIN" && (
                <select
                  aria-label={`Rolle von ${m.name}`}
                  value={m.role}
                  onChange={(e) => setRole(m, e.target.value as TenantRole)}
                  className="h-8 rounded-full border border-border bg-inset px-3 text-[13px] font-bold text-foreground outline-none"
                >
                  {ROLES.map(([r, l]) => (
                    <option key={r} value={r}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              <AdminGrantCreditsButton clubSlug={slug} userId={m.id} userName={m.name} />
              </div>
            </div>
            {isPaid ? (
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
                className={cn(pill, "bg-clay text-white")}
              >
                Erinnern
              </button>
            )}
          </div>
        );
      })}
      </div>
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
          Aus Excel kopieren und einfügen oder CSV wählen. Spalten: Vorname, Nachname, E-Mail, Telefon, optional Geburtsdatum, Geschlecht
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
          <label className="block">
            <span className={fieldLabel}>Rolle</span>
            <select value={f.role} onChange={(e) => set({ role: e.target.value as TenantRole })} className={field}>
              {ROLES.map(([r, l]) => <option key={r} value={r}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={fieldLabel}>Abo {current?.planId ? `(aktuell: ${current.plan})` : ""}</span>
            <select value={f.planId} onChange={(e) => set({ planId: e.target.value })} className={field}>
              <option value="">{current?.planId ? "unverändert" : "kein Abo"}</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · CHF {p.price}</option>)}
              {current?.planId && <option value="__end">Abo beenden</option>}
            </select>
          </label>
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
