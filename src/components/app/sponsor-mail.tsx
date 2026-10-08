"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MAIL_TEMPLATES, fillPlaceholders } from "@/lib/sponsoring";
import { Sheet } from "@/components/app/sheet";
import { field, fieldLabel, pill } from "@/components/app/admin-sponsoring";
import { sendBulkMailAction } from "@/app/actions/sponsor-crm";

type Recipient = { id: string; name: string; email: string; firstName: string };

export function SponsorMailSheet({ open, onClose, slug, recipients, onDone }: {
  open: boolean; onClose: () => void; slug: string; recipients: Recipient[]; onDone: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ sent: number; skipped: string[] } | null>(null);
  const [pending, start] = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const noMail = recipients.filter((r) => !r.email);
  const first = recipients.find((r) => r.email);

  function insert(tag: string) {
    const el = bodyRef.current;
    const a = el?.selectionStart ?? body.length, b = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, a) + tag + body.slice(b));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + tag.length, a + tag.length); });
  }
  const close = () => { if (result) onDone(); else onClose(); setResult(null); };
  const v = first ? { firma: first.name, vorname: first.firstName } : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} title="Mail an Sponsoren">
      {result ? (
        <div className="grid gap-3">
          <div className="text-[24px] font-bold tracking-[-.03em]">{result.sent} Mails gesendet</div>
          <p className="text-[14px] text-muted-foreground">Im Verlauf jedes Sponsors vermerkt.</p>
          {result.skipped.length > 0 && <p className="rounded-[14px] bg-warn-bg p-3 text-[14px] text-warn">Nicht gesendet: {result.skipped.join(", ")}</p>}
          <button type="button" onClick={close} className="btn btn-pri h-[52px] w-full">Fertig</button>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="text-[24px] font-bold tracking-[-.03em]">Mail an {recipients.length} Sponsoren</div>
          {noMail.length > 0 && <p className="text-[14px] text-warn">{noMail.length} ohne E-Mail werden übersprungen.</p>}
          <label className={fieldLabel}>Vorlage
            <select defaultValue="leer" onChange={(e) => { const t = MAIL_TEMPLATES.find((x) => x.id === e.target.value); if (t) { setSubject(t.subject); setBody(t.body); } }} className={field}>
              {MAIL_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className={fieldLabel}>Betreff<input ref={subjectRef} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={field} /></label>
          <label className={fieldLabel}>Text
            <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="mt-1.5 w-full rounded-[15px] border border-border bg-inset p-3 text-[16px] outline-none focus-visible:border-clay" />
          </label>
          <div className="flex gap-2">
            {["{Firma}", "{Vorname}"].map((t) => <button key={t} type="button" onClick={() => insert(t)} className={cn(pill, "bg-bg text-ink")}>{t}</button>)}
          </div>
          {v && (
            <div className="rounded-[14px] bg-inset p-3 text-[14px]">
              <div className="text-[12px] font-bold uppercase tracking-[.06em] text-muted-foreground">Vorschau für {first!.name}</div>
              <div className="mt-1 font-semibold">{fillPlaceholders(subject, v) || "(Betreff)"}</div>
              <div className="mt-1 whitespace-pre-wrap">{fillPlaceholders(body, v) || "(Text)"}</div>
            </div>
          )}
          <button type="button" disabled={pending || !first || !subject.trim() || !body.trim()} className="btn btn-pri h-[52px] w-full" onClick={() => start(async () => {
            if (!window.confirm(`Achtung: Das verschickt ${recipients.length - noMail.length} ECHTE E-Mails an Sponsoren. Fortfahren?`)) return;
            const r = await sendBulkMailAction(slug, recipients.map((x) => x.id), subject, body);
            if (r.success) setResult({ sent: r.sent, skipped: r.skipped }); else toast.error(r.error);
          })}>{pending ? "Sende …" : `An ${recipients.length - noMail.length} senden`}</button>
        </div>
      )}
    </Sheet>
  );
}
