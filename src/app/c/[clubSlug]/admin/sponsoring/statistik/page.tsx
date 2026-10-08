import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { DAY, STAGES, chf, contractAmount, contractEnd, hasYear, renewalRate } from "@/lib/sponsoring";
import { currentSponsorYear } from "@/lib/sponsor-server";
import { cn } from "@/lib/utils";

const nowMs = () => Date.now();
const pill = "inline-flex min-h-10 items-center justify-center rounded-full px-3.5 py-2 text-[13px] font-bold";

export default async function SponsoringStatsPage({ params, searchParams }: { params: Promise<{ clubSlug: string }>; searchParams: Promise<{ jahr?: string }> }) {
  const [{ clubSlug }, { jahr }] = await Promise.all([params, searchParams]);
  const { tenant } = await requireTenantAdmin(clubSlug);
  const year = Number(jahr) || (await currentSponsorYear(tenant.id));
  const base = `/c/${tenant.slug}/admin/sponsoring`;

  const [sponsors, invoices] = await Promise.all([
    prisma.sponsor.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true, stage: true, contracts: { where: { cancelledAt: null }, include: { lines: true } } } }),
    prisma.sponsorInvoice.findMany({ where: { tenantId: tenant.id, year: { gte: year - 3, lte: year } }, select: { year: true, amount: true, paidAt: true } }),
  ]);

  const years = [year - 3, year - 2, year - 1, year].map((y) => {
    const inv = invoices.filter((i) => i.year === y);
    const paid = inv.filter((i) => i.paidAt).reduce((a, i) => a + Number(i.amount), 0);
    return { y, paid, open: inv.reduce((a, i) => a + Number(i.amount), 0) - paid };
  });
  const cur = years[3];
  const maxY = Math.max(1, ...years.map((r) => r.paid + r.open));

  const curSet = new Set<string>(), prevSet = new Set<string>();
  const now = nowMs();
  const active = sponsors.flatMap((s) => {
    const c = s.contracts.find((x) => hasYear(x, year));
    if (c) curSet.add(s.id);
    if (s.contracts.some((x) => hasYear(x, year - 1))) prevSet.add(s.id);
    return c ? [{ id: s.id, name: s.name, amount: contractAmount(c, year), end: contractEnd(c) }] : [];
  });
  const renewal = renewalRate(prevSet, curSet);
  const top = [...active].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const ending = active.filter((a) => a.end && a.end.getTime() >= now && a.end.getTime() - now <= 90 * DAY).sort((a, b) => +a.end! - +b.end!);
  const byStage = STAGES.map((st) => ({ ...st, n: sponsors.filter((s) => s.stage === st.value).length }));
  const maxS = Math.max(1, ...byStage.map((x) => x.n));
  const offers = byStage.filter((x) => x.value === "OFFER" || x.value === "NEGOTIATION").reduce((a, x) => a + x.n, 0);

  const tile = (label: string, value: string, sub: string, hero = false) => (
    <div className={cn("card flex flex-col gap-1 p-4", hero && "bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_70%)] text-white")}>
      <span className={cn("text-[13px] font-semibold", hero ? "text-white/85" : "text-ink-3")}>{label}</span>
      <b className="text-[22px] font-bold leading-tight tracking-[-.03em] tabular-nums">{value}</b>
      <small className={cn("text-[12.5px]", hero ? "text-white/85" : "text-ink-3")}>{sub}</small>
    </div>
  );
  const h2 = "text-[17px] font-bold";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-3 @min-[640px]:pt-0">
        <div>
          <Link href={`${base}?jahr=${year}`} className="text-[14px] font-semibold text-brand-deep">‹ Sponsoring</Link>
          <h1 className="text-[28px] font-bold tracking-[-.03em]">Sponsoring-Statistik</h1>
        </div>
        <span className="flex items-center gap-1">
          <Link href={`?jahr=${year - 1}`} aria-label="Vorjahr" className={cn(pill, "bg-card shadow-card")}>‹</Link>
          <b className="px-2 text-[15px] tabular-nums">{year}</b>
          <Link href={`?jahr=${year + 1}`} aria-label="Folgejahr" className={cn(pill, "bg-card shadow-card")}>›</Link>
        </span>
      </div>

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 px-5 pt-4 @min-[1024px]:grid-cols-5">
        {tile("Bezahlt", chf(cur.paid), `Rechnungen ${year}`, true)}
        {tile("Offen", chf(cur.open), cur.open > 0 ? "noch nicht bezahlt" : "nichts offen")}
        {tile("Sponsoren mit Vertrag", String(active.length), `im Jahr ${year}`)}
        {tile("Verlängerungsquote", renewal == null ? "–" : `${Math.round(renewal * 100)} %`, `von ${prevSet.size} Sponsoren ${year - 1}`)}
        {tile("Offene Angebote", String(offers), "Angebot oder Verhandlung")}
      </section>

      <div className="grid items-start gap-3 px-5 pt-3 @min-[1024px]:grid-cols-2">
        <section className="card p-5">
          <h2 className={h2}>Einnahmen letzte 4 Jahre</h2>
          <div className="mt-3 grid gap-2">
            {years.map((r) => (
              <div key={r.y} className="grid grid-cols-[40px_minmax(0,1fr)_72px] items-center gap-2.5 text-[13.5px] font-semibold">
                <span className="tabular-nums">{r.y}</span>
                <span className="flex h-2.5 overflow-hidden rounded-full bg-inset">
                  <i className="block h-full bg-brand-deep" style={{ width: `${(r.paid / maxY) * 100}%` }} />
                  <i className="block h-full bg-brand-soft" style={{ width: `${(r.open / maxY) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-ink-2">{chf(r.paid + r.open).replace("CHF ", "").replace(/\.\d\d$/, "")}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">dunkel: bezahlt · hell: offen, nach Rechnungsjahr</p>
        </section>

        <section className="card p-5">
          <h2 className={h2}>Sponsoren nach Stufe</h2>
          <div className="mt-3 grid gap-2">
            {byStage.map((x) => (
              <div key={x.value} className="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-2.5 text-[13.5px] font-semibold">
                <span>{x.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-inset"><i className={cn("block h-full rounded-full", x.value === "LOST" ? "bg-bad" : "bg-brand-deep")} style={{ width: `${(x.n / maxS) * 100}%` }} /></span>
                <span className="text-right tabular-nums">{x.n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className={h2}>Top 5 nach Betrag {year}</h2>
          <ul className="mt-2 divide-y divide-line">
            {top.map((s, i) => (
              <li key={s.id}><Link href={`${base}/${s.id}`} className="flex items-center gap-3 py-2.5"><span className="w-4 text-ink-3">{i + 1}</span><b className="min-w-0 flex-1 truncate">{s.name}</b><span className="tabular-nums">{chf(s.amount)}</span></Link></li>
            ))}
            {!top.length && <li className="py-3 text-[14px] text-ink-3">Keine Verträge in diesem Jahr.</li>}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className={h2}>Endet in den nächsten 90 Tagen</h2>
          <ul className="mt-2 divide-y divide-line">
            {ending.map((s) => (
              <li key={s.id}><Link href={`${base}/${s.id}`} className="flex items-center gap-3 py-2.5"><b className="min-w-0 flex-1 truncate">{s.name}</b><span className="rounded-full bg-warn-bg px-2.5 py-1 text-[12px] font-bold text-warn">{Math.ceil((s.end!.getTime() - now) / DAY)} Tage</span></Link></li>
            ))}
            {!ending.length && <li className="py-3 text-[14px] text-ink-3">Keine Verträge, die bald enden.</li>}
          </ul>
        </section>
      </div>

      <div className="px-5 pb-8 pt-4">
        <a href={`${base}/export`} download className="btn btn-ghost w-full">Sponsorenliste als CSV exportieren</a>
      </div>
    </>
  );
}
