"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, Spinner } from "@/components/app/avatar";
import { Sheet } from "@/components/app/sheet";
import { markInvoiceAsPaidManually, sendPaymentReminderAction } from "@/actions/admin-billing";
import { importMembersAction, setMemberRoleAction } from "@/app/actions/club-settings";
import { parseMembers } from "@/lib/member-import";
import type { TenantRole } from "@/types";
import { initials } from "@/lib/courts";
import { cn } from "@/lib/utils";

export interface MemberRow {
  id: string;
  name: string;
  plan: string;
  /** paid = ACTIVE membership, invoice = PENDING offline invoice, remind = anything else */
  state: "paid" | "invoice" | "remind";
  stripeCustomerId: string | null;
  role: TenantRole;
}

const ROLES: [TenantRole, string][] = [
  ["MEMBER", "Mitglied"],
  ["COACH", "Trainer"],
  ["GUEST", "Gast"],
  ["CLUB_ADMIN", "Admin"],
];

const pill = "rounded-full px-3.5 py-2 text-[13px] font-bold";

export function AdminMembers({ slug, tenantId, members }: { slug: string; tenantId: string; members: MemberRow[] }) {
  const router = useRouter();
  const [reminded, setReminded] = useState<string[]>([]);
  const [paid, setPaid] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function markPaid(m: MemberRow) {
    if (!m.stripeCustomerId || busy) return;
    setBusy(m.id);
    const res = await markInvoiceAsPaidManually(tenantId, m.id, m.stripeCustomerId);
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
    <div className="flex flex-col gap-2.5 px-5 pt-4 lg:grid lg:grid-cols-2">
      {members.map((m) => {
        const isPaid = m.state === "paid" || paid.includes(m.id);
        const sent = reminded.includes(m.id);
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5">
            <Avatar ini={initials(m.name)} />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold">{m.name}</div>
              <div className="text-[14px] text-muted-foreground">{m.plan}</div>
              {m.role !== "PLATFORM_ADMIN" && (
                <select
                  aria-label={`Rolle von ${m.name}`}
                  value={m.role}
                  onChange={(e) => setRole(m, e.target.value as TenantRole)}
                  className="mt-1.5 h-8 rounded-full border border-border bg-inset px-3 text-[13px] font-bold text-foreground outline-none"
                >
                  {ROLES.map(([r, l]) => (
                    <option key={r} value={r}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
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
    if (file) setText(await file.text());
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
          Aus Excel kopieren und einfügen oder CSV wählen. Spalten: Vorname, Nachname, E-Mail, Telefon
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
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#e25b36]"
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
