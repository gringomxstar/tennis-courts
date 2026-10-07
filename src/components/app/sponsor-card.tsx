"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DISCOUNT, chf, yearlyAmount } from "@/lib/sponsoring";
import { Sheet } from "@/components/app/sheet";
import { ConfirmButton } from "@/components/app/confirm-button";
import { STATUS, field, fieldLabel, pill, type SponsorStatus } from "@/components/app/admin-sponsoring";
import {
  addDeliverableAction, billYearAction, completeTaskAction, createContractAction, deleteSponsorAction, endContractAction,
  markInvoicePaidAction, renewPortalLinkAction, resendInvoiceAction, saveSponsorAction, setRequestStatusAction, toggleDeliverableAction,
} from "@/app/actions/sponsoring";

type Contact = { name: string; email: string; phone: string; role: string; isPrimary: boolean };
type Contract = { id: string; startYear: number; years: number; discountPct: number; source: string; cancelled: boolean; amount: number; lines: { name: string; quantity: number; price: number; fromYear: number | null; pending: boolean }[]; billedYears: number[] };
type Invoice = { id: string; number: number; year: number; amount: number; dueAt: string; paidAt: string; dunningLevel: number; sent: boolean; overdue: boolean };
const de = (iso: string) => new Date(iso).toLocaleDateString("de-CH");

export function SponsorCard(p: {
  slug: string; year: number; status: SponsorStatus;
  sponsor: { id: string; name: string; street: string; zip: string; city: string; website: string; notes: string; ownerId: string; portal: string; token: string; logo: { type: string; confirmed: string } | null; contacts: Contact[] };
  board: { id: string; name: string }[]; items: { id: string; name: string; price: number; free: number | null }[];
  contracts: Contract[]; years: { year: number; status: string }[]; invoices: Invoice[];
  deliverables: { id: string; year: number; label: string; done: boolean }[]; tasks: { id: string; title: string; assignee: string }[];
  history: { at: string; text: string; by: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [contractOpen, setContractOpen] = useState(false);
  const s = p.sponsor;
  const running = p.contracts.find((c) => !c.cancelled && c.startYear <= p.year && p.year < c.startYear + c.years) ?? null;
  const contact = s.contacts.find((c) => c.isPrimary) ?? s.contacts[0];
  const open = p.invoices.filter((i) => !i.paidAt && (i.overdue || i.year === p.year));
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) => start(async () => {
    const r = await fn().catch(() => ({ success: false, error: "Verbindung fehlgeschlagen." }));
    if (!r.success) return void toast.error(r.error ?? "Fehler");
    if (ok) toast.success(ok);
    router.refresh();
  });

  return (
    <div className="grid gap-4 px-5 pb-10 pt-4 @min-[1024px]:grid-cols-[1fr_380px] @min-[1024px]:items-start">
      <div className="grid gap-4">
        <section className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-[17px] font-bold">Saison {p.year}</h2>
            <span className={cn("rounded-full px-3 py-1 text-[13px] font-bold", STATUS[p.status][1])}>{STATUS[p.status][0]}</span>
          </div>
          {running && (
            <div className="mt-2">
              <b className="block text-[24px] tracking-[-.02em] tabular-nums">{chf(running.amount)} / Jahr</b>
              <span className="text-[14px] text-ink-3">
                Vertrag {running.startYear}{running.years > 1 ? `–${running.startYear + running.years - 1}` : ""}{running.discountPct ? ` · −${running.discountPct} %` : ""}
                {contact ? ` · ${contact.name}` : ""}
              </span>
            </div>
          )}
          {open.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {open.map((i) => (
                <li key={i.id} className={cn("flex flex-wrap items-center gap-2 rounded-[14px] p-3 text-[14px]", i.overdue ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn")}>
                  <span className="min-w-0 flex-1 basis-40">Rechnung {i.year} · {chf(i.amount)} · {i.overdue ? "überfällig" : `offen bis ${de(i.dueAt)}`}</span>
                  <button type="button" disabled={pending} onClick={() => run(() => resendInvoiceAction(p.slug, i.id), "Rechnung erneut verschickt")} className={cn(pill, "bg-card text-ink")}>Nochmals senden</button>
                  <button type="button" disabled={pending} onClick={() => run(() => markInvoicePaidAction(p.slug, i.id, true), "Als bezahlt markiert")} className={cn(pill, "bg-brand-deep text-white")}>Bezahlt</button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setContractOpen(true)} className={cn(pill, "bg-brand-deep text-white")}>{p.status === "CONFIRMED" ? "+ Angebot dazukaufen" : "+ Vertrag erfassen"}</button>
            <button type="button" onClick={() => navigator.clipboard.writeText(s.portal).then(() => toast.success("Link kopiert"))} className={cn(pill, "bg-bg text-ink")}>Portal-Link kopieren</button>
            <a href={s.portal} target="_blank" rel="noreferrer" className={cn(pill, "bg-bg text-ink")}>Portal öffnen</a>
            {p.status !== "CONFIRMED" && p.status !== "DECLINED" && (
              <button type="button" disabled={pending} onClick={() => run(() => setRequestStatusAction(p.slug, s.id, p.year, "DECLINED"), "Absage erfasst")} className={cn(pill, "bg-bg text-ink")}>Absage erfassen</button>
            )}
            {p.status === "DECLINED" && (
              <button type="button" disabled={pending} onClick={() => run(() => setRequestStatusAction(p.slug, s.id, p.year, "REQUESTED"))} className={cn(pill, "bg-bg text-ink")}>Wieder auf angefragt</button>
            )}
          </div>
          {p.tasks.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {p.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-[14px] bg-warn-bg p-3 text-[14px] text-warn">
                  <span className="flex-1">{t.title}{t.assignee ? ` · ${t.assignee}` : ""}</span>
                  <button type="button" disabled={pending} onClick={() => run(() => completeTaskAction(p.slug, t.id))} className={cn(pill, "bg-card text-ink")}>Erledigt</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Deliverables slug={p.slug} sponsorId={s.id} year={p.year} items={p.deliverables} pending={pending} run={run} />

        <section className="card p-5">
          <h2 className="text-[17px] font-bold">Verträge</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.years.map((y) => (
              <span key={y.year} className={cn("rounded-full px-3 py-1 text-[12.5px] font-bold", STATUS[y.status as SponsorStatus][1])}>{y.year}: {STATUS[y.status as SponsorStatus][0]}</span>
            ))}
          </div>
          <ul className="mt-3 grid gap-3">
            {p.contracts.map((c) => {
              const end = c.startYear + c.years - 1;
              const unbilled = Array.from({ length: c.years }, (_, i) => c.startYear + i).filter((y) => y <= p.year && !c.billedYears.includes(y));
              return (
                <li key={c.id} className={cn("rounded-[16px] bg-bg p-4", c.cancelled && "opacity-60")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <b>{c.startYear}{c.years > 1 ? `–${end}` : ""}{c.cancelled ? " · storniert" : ""}</b>
                    <span className="text-[14px] tabular-nums">{chf(c.amount)} / Jahr{c.discountPct ? ` (−${c.discountPct} %)` : ""}</span>
                  </div>
                  <ul className="mt-1 text-[14px] text-ink-2">
                    {c.lines.map((l, i) => (
                      <li key={i}>
                        {l.quantity > 1 ? `${l.quantity}× ` : ""}{l.name}
                        {l.fromYear != null && <span className="text-ink-3"> · dazugekauft ab {l.fromYear}</span>}
                        {l.pending && <span className="font-semibold text-warn"> · Online-Zahlung läuft</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="text-[12.5px] text-ink-3">{c.source === "portal" ? "online bestätigt" : c.source === "import" ? "aus Excel" : "vom Vorstand erfasst"}</div>
                  {!c.cancelled && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.source !== "import" && unbilled.map((y) => (
                        <button key={y} type="button" disabled={pending} onClick={() => run(() => billYearAction(p.slug, c.id, y), `Rechnung ${y} erstellt`)} className={cn(pill, "bg-card text-ink")}>Rechnung {y} erstellen</button>
                      ))}
                      {end >= p.year && (
                        <ConfirmButton disabled={pending} onConfirm={() => run(() => endContractAction(p.slug, c.id, c.startYear >= p.year ? c.startYear : p.year), "Vertrag angepasst")} confirm={c.startYear >= p.year ? "Ganz stornieren?" : `Nach ${p.year - 1} beenden?`} className={cn(pill, "bg-card text-ink")}>{c.startYear >= p.year ? "Stornieren" : `Ab ${p.year} beenden`}</ConfirmButton>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {!p.contracts.length && <li className="text-[14px] text-ink-3">Noch kein Vertrag.</li>}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="text-[17px] font-bold">Rechnungen</h2>
          <ul className="mt-2 divide-y divide-line">
            {p.invoices.map((i) => {
              const overdue = i.overdue;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5 text-[14.5px]">
                  <a href={`/sponsor/${s.token}/rechnung/${i.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-deep">Nr. {i.number} · {i.year}</a>
                  <span className="tabular-nums">{chf(i.amount)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", i.paidAt ? "bg-ok-bg text-ok" : overdue ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn")}>
                    {i.paidAt ? `bezahlt ${de(i.paidAt)}` : overdue ? `überfällig${i.dunningLevel ? ` · ${Math.min(i.dunningLevel, 2)}. Mahnung` : ""}` : `offen bis ${de(i.dueAt)}`}
                  </span>
                  {!i.sent && <span className="text-[12.5px] text-ink-3">nicht verschickt</span>}
                  <span className="ml-auto flex gap-2">
                    {!i.paidAt && <button type="button" disabled={pending} onClick={() => run(() => resendInvoiceAction(p.slug, i.id), "Rechnung verschickt")} className={cn(pill, "bg-bg text-ink")}>Senden</button>}
                    <button type="button" disabled={pending} onClick={() => run(() => markInvoicePaidAction(p.slug, i.id, !i.paidAt))} className={cn(pill, i.paidAt ? "bg-bg text-ink" : "bg-brand-deep text-white")}>{i.paidAt ? "Doch offen" : "Bezahlt"}</button>
                  </span>
                </li>
              );
            })}
            {!p.invoices.length && <li className="py-2 text-[14px] text-ink-3">Noch keine Rechnung.</li>}
          </ul>
        </section>

      </div>

      <div className="grid gap-4">
        <Details slug={p.slug} sponsor={s} board={p.board} />
        <section className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold">Logo</h2>
            {s.logo && <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", s.logo.confirmed ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn")}>{s.logo.confirmed ? `bestätigt ${de(s.logo.confirmed)}` : "nicht bestätigt"}</span>}
          </div>
          {s.logo ? (
            <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-white p-3">
              {s.logo.type.startsWith("image/") ? <img src={`/sponsor/${s.token}/logo`} alt={`Logo ${s.name}`} className="max-h-20 max-w-[60%] object-contain" /> : <span className="text-[14px] text-ink-2">PDF</span>}
              <a href={`/sponsor/${s.token}/logo?download`} className="ml-auto text-[13.5px] font-semibold text-brand-deep">Herunterladen</a>
            </div>
          ) : <p className="mt-1 text-[14px] text-ink-3">Der Sponsor lädt sein Logo im Portal hoch.</p>}
        </section>
        <section className="card p-5">
          <h2 className="text-[17px] font-bold">Verlauf</h2>
          <ol className="mt-2 grid gap-2">
            {p.history.map((h, i) => (
              <li key={i} className="grid grid-cols-[86px_1fr] gap-2 text-[14px]">
                <span className="tabular-nums text-ink-3">{de(h.at)}</span>
                <span>{h.text}<span className="text-ink-3"> · {h.by}</span></span>
              </li>
            ))}
            {!p.history.length && <li className="text-[14px] text-ink-3">Noch keine Einträge.</li>}
          </ol>
        </section>
        <section className="card grid gap-2 p-5">
          <ConfirmButton disabled={pending} onConfirm={() => run(() => renewPortalLinkAction(p.slug, s.id), "Neuer Link erstellt")} confirm="Alter Link geht dann nicht mehr. Sicher?" className={cn(pill, "bg-bg text-ink")}>Neuen Portal-Link erstellen</ConfirmButton>
          <ConfirmButton disabled={pending} onConfirm={() => start(async () => {
            const r = await deleteSponsorAction(p.slug, s.id);
            if (!r.success) return void toast.error(r.error);
            router.push(`/c/${p.slug}/admin/sponsoring`);
          })} confirm={`${s.name} wirklich löschen?`} className={cn(pill, "bg-bg text-bad")}>Sponsor löschen</ConfirmButton>
        </section>
      </div>

      <ContractSheet open={contractOpen} onClose={() => setContractOpen(false)} slug={p.slug} sponsorId={s.id} year={p.year} items={p.items} running={p.status === "CONFIRMED" ? running : null} />
    </div>
  );
}

function Details({ slug, sponsor: s, board }: { slug: string; sponsor: Parameters<typeof SponsorCard>[0]["sponsor"]; board: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [contacts, setContacts] = useState<Contact[]>(s.contacts.length ? s.contacts : [{ name: "", email: "", phone: "", role: "", isPrimary: true }]);
  const set = (i: number, patch: Partial<Contact>) => setContacts(contacts.map((c, j) => (j === i ? { ...c, ...patch } : patch.isPrimary ? { ...c, isPrimary: false } : c)));
  return (
    <form className="card grid gap-3 p-5" action={(fd) => start(async () => {
      const v = (k: string) => String(fd.get(k) ?? "");
      const r = await saveSponsorAction(slug, { id: s.id, name: v("name"), street: v("street"), zip: v("zip"), city: v("city"), website: v("website"), notes: v("notes"), ownerId: v("ownerId"), contacts });
      if (!r.success) return void toast.error(r.error);
      toast.success("Gespeichert");
      router.refresh();
    })}>
      <h2 className="text-[17px] font-bold">Stammdaten</h2>
      <label className={fieldLabel}>Firma<input name="name" defaultValue={s.name} required className={field} /></label>
      <label className={fieldLabel}>Strasse<input name="street" defaultValue={s.street} className={field} /></label>
      <div className="grid grid-cols-[100px_1fr] gap-2">
        <label className={fieldLabel}>PLZ<input name="zip" defaultValue={s.zip} className={field} /></label>
        <label className={fieldLabel}>Ort<input name="city" defaultValue={s.city} className={field} /></label>
      </div>
      <label className={fieldLabel}>Website<input name="website" defaultValue={s.website} className={field} /></label>
      <label className={fieldLabel}>Verantwortlich im Vorstand
        <select name="ownerId" defaultValue={s.ownerId} className={field}>
          <option value="">Niemand</option>
          {board.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <label className={fieldLabel}>Notizen<textarea name="notes" defaultValue={s.notes} rows={3} className={cn(field, "h-auto py-3")} /></label>
      <div className={fieldLabel}>Kontakte</div>
      {contacts.map((c, i) => (
        <fieldset key={i} className="grid gap-2 rounded-[14px] bg-bg p-3">
          <input aria-label="Name" placeholder="Name" value={c.name} onChange={(e) => set(i, { name: e.target.value })} className={cn(field, "mt-0 h-11 bg-card")} />
          <input aria-label="E-Mail" placeholder="E-Mail" type="email" value={c.email} onChange={(e) => set(i, { email: e.target.value })} className={cn(field, "mt-0 h-11 bg-card")} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Telefon" placeholder="Telefon" value={c.phone} onChange={(e) => set(i, { phone: e.target.value })} className={cn(field, "mt-0 h-11 bg-card")} />
            <input aria-label="Funktion" placeholder="Funktion" value={c.role} onChange={(e) => set(i, { role: e.target.value })} className={cn(field, "mt-0 h-11 bg-card")} />
          </div>
          <div className="flex items-center justify-between text-[13.5px]">
            <label className="flex items-center gap-2"><input type="radio" name="primary" checked={c.isPrimary} onChange={() => set(i, { isPrimary: true })} />Bekommt Mails und Rechnungen</label>
            {contacts.length > 1 && <button type="button" onClick={() => setContacts(contacts.filter((_, j) => j !== i))} className="font-semibold text-bad">Entfernen</button>}
          </div>
        </fieldset>
      ))}
      <button type="button" onClick={() => setContacts([...contacts, { name: "", email: "", phone: "", role: "", isPrimary: false }])} className={cn(pill, "bg-bg text-ink")}>+ Kontakt</button>
      <button disabled={pending} className="btn btn-pri h-[50px] w-full">{pending ? "…" : "Speichern"}</button>
    </form>
  );
}

function Deliverables({ slug, sponsorId, year, items, pending, run }: {
  slug: string; sponsorId: string; year: number; items: { id: string; year: number; label: string; done: boolean }[]; pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) => void;
}) {
  const [label, setLabel] = useState("");
  const years = [...new Set([year, ...items.map((d) => d.year)])].sort((a, b) => b - a);
  return (
    <section className="card p-5">
      <h2 className="text-[17px] font-bold">Was wir liefern</h2>
      <p className="text-[13.5px] text-ink-3">Was wir dem Sponsor schulden. Kommt automatisch aus den gekauften Angeboten. Abhaken, sobald erledigt.</p>
      {years.map((y) => {
        const list = items.filter((d) => d.year === y);
        if (!list.length && y !== year) return null;
        return (
          <div key={y} className="mt-3">
            <div className="text-[13px] font-bold uppercase tracking-[.06em] text-ink-3">{y} · {list.filter((d) => d.done).length}/{list.length} erledigt</div>
            <ul className="mt-1 grid gap-1">
              {list.map((d) => (
                <li key={d.id}>
                  <label className="flex items-center gap-3 py-1 text-[15px]">
                    <input type="checkbox" checked={d.done} disabled={pending} onChange={() => run(() => toggleDeliverableAction(slug, d.id, !d.done))} className="h-5 w-5 accent-[var(--brand-deep)]" />
                    <span className={cn(d.done && "text-ink-3 line-through")}>{d.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (label.trim()) run(() => addDeliverableAction(slug, sponsorId, year, label), "Hinzugefügt"); setLabel(""); }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Weitere für ${year}, z.B. Einladung Apéro`} aria-label="Weitere Lieferung hinzufügen" className={cn(field, "mt-0 h-11")} />
        <button disabled={pending || !label.trim()} className={cn(pill, "bg-bg text-ink")}>+</button>
      </form>
    </section>
  );
}

function ContractSheet({ open, onClose, slug, sponsorId, year, items, running }: {
  open: boolean; onClose: () => void; slug: string; sponsorId: string; year: number; items: { id: string; name: string; price: number; free: number | null }[];
  running: Contract | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [startYear, setStartYear] = useState(year);
  const [years, setYears] = useState(1);
  const [qty, setQty] = useState<Record<string, number>>({});
  const lines = Object.entries(qty).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity }));
  const total = yearlyAmount(lines.map((l) => ({ quantity: l.quantity, unitPrice: items.find((i) => i.id === l.itemId)?.price ?? 0 })), running ? running.discountPct : DISCOUNT[years]);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={running ? "Angebot dazukaufen" : "Vertrag erfassen"}>
      <p className="mt-1 text-[13.5px] text-ink-3">
        {running
          ? `Läuft bis ${running.startYear + running.years - 1} wie der bestehende Vertrag${running.discountPct ? `, mit −${running.discountPct} %` : ""}. Voller Jahrespreis, die Zusatzrechnung geht sofort per E-Mail raus.`
          : "Z.B. nach einer Zusage am Telefon. Die Rechnung für das erste Jahr geht sofort per E-Mail raus."}
      </p>
      {!running && <div className="mt-3 grid grid-cols-2 gap-3">
        <label className={fieldLabel}>Ab Jahr<input type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} className={field} /></label>
        <label className={fieldLabel}>Laufzeit
          <select value={years} onChange={(e) => setYears(Number(e.target.value))} className={field}>
            {[1, 2, 3].map((y) => <option key={y} value={y}>{y} {y === 1 ? "Jahr" : `Jahre (−${DISCOUNT[y]} %)`}</option>)}
          </select>
        </label>
      </div>}
      <ul className="mt-3 divide-y divide-line">
        {items.map((it) => {
          const q = qty[it.id] ?? 0;
          return (
            <li key={it.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{it.name}</div>
                <div className="text-[12.5px] text-ink-3">{chf(it.price)}{it.free != null ? ` · ${it.free} frei ${year}` : ""}</div>
              </div>
              <button type="button" aria-label={`${it.name} weniger`} disabled={!q} onClick={() => setQty({ ...qty, [it.id]: q - 1 })} className="btn btn-ghost h-9 w-9 px-0">−</button>
              <span className="w-6 text-center font-bold tabular-nums">{q}</span>
              <button type="button" aria-label={`${it.name} mehr`} onClick={() => setQty({ ...qty, [it.id]: q + 1 })} className="btn btn-ghost h-9 w-9 px-0">+</button>
            </li>
          );
        })}
        {!items.length && <li className="py-3 text-[14px] text-ink-3">Noch keine Angebote im Katalog. <Link href={`/c/${slug}/admin/sponsoring/katalog`} className="font-semibold text-clay-text underline">Angebot anlegen ›</Link></li>}
      </ul>
      <button type="button" disabled={!lines.length || pending} className="btn btn-pri mt-4 h-[52px] w-full" onClick={() => start(async () => {
        const r = await createContractAction(slug, sponsorId, startYear, years, lines);
        if (!r.success) return void toast.error(r.error);
        toast.success("Vertrag erfasst, Rechnung verschickt");
        setQty({});
        onClose();
        router.refresh();
      })}>{pending ? "…" : `Erfassen und Rechnung senden · ${chf(total)} / Jahr`}</button>
    </Sheet>
  );
}
