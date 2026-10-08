import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { AGE_CLASSES, EXPORTS, METHODS, METHOD_LABEL, chDate, loadStats } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";

const card = "card p-4 @min-[640px]:p-5 break-inside-avoid";
const h2 = "text-[18px] font-bold tracking-[-.02em]";
const sub = "mt-1 text-[14px] leading-[1.4] text-muted-foreground";
const th = "px-2 py-1.5 text-left text-[12px] font-bold uppercase tracking-[.04em] text-muted-foreground";
const td = "px-2 py-1.5 text-[14px] tabular-nums";
const chf = (n: number) => new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[24px] font-bold leading-tight tracking-[-.03em] tabular-nums">{value}</div>
      {hint && <div className="text-[12px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <span className="text-muted-foreground">–</span>;
  const d = (cur - prev) / prev;
  return <span className="text-muted-foreground">{d >= 0 ? "+" : "−"}{Math.abs(Math.round(d * 100))}%</span>;
}

export default async function AdminStatsPage({ params, searchParams }: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const thisYear = new Date().getFullYear();
  const year = Math.min(thisYear, Math.max(2020, Number((await searchParams).year) || thisYear));
  const base = `/c/${tenant.slug}/admin/stats`;

  if (!process.env.DATABASE_URL) {
    return <div className="px-5 pt-3 @min-[640px]:px-0 @min-[640px]:pt-0 text-[15px] text-muted-foreground">Statistik braucht eine Datenbank.</div>;
  }
  const settings = tenant.settingsJson;
  const s = await loadStats(tenant.id, year, settings?.openingHour ?? 7, settings?.closingHour ?? 22);
  const { kasse, auslastung: a, gv, pflege, junioren: j } = s;
  // Leistungsprinzip (Treuhänder): a top-up is a liability, revenue arises with the booking (incl. paid from Guthaben)
  const monthTotal = (m: (typeof kasse.months)[number]) => METHODS.reduce((t, k) => t + m.byMethod[k], 0) + m.abos + m.sponsoring;
  const yearTotal = kasse.months.reduce((t, m) => t + monthTotal(m), 0);

  const months = kasse.months.map(monthTotal);
  const maxM = Math.max(1, ...months);
  const peak = months.indexOf(Math.max(...months));
  const kpi = (label: string, value: string, sub: string, hero = false, warn = false) => (
    <div className={cn("card flex flex-col gap-2.5 p-4 @min-[640px]:px-[22px] @min-[640px]:py-5", hero && "bg-[linear-gradient(135deg,#1a8a75,#0f5c4f_70%)] text-white")}>
      <span className="text-[14px] font-medium opacity-85">{label}</span>
      <b className={cn("text-[24px] font-bold leading-none tracking-[-.04em] tabular-nums @min-[640px]:text-[32px]", warn && "text-warn")}>{value}</b>
      <span className="text-[13px] font-semibold opacity-85">{sub}</span>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-3 @min-[640px]:px-0 @min-[640px]:pt-0">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-.03em]">Statistik</h1>
          <div className="mt-0.5 text-[15px] text-muted-foreground">Kalenderjahr {year}, nach Zahlungsdatum</div>
        </div>
        <a href={`${base}/export?type=kasse&year=${year}`} download className="btn print:hidden">CSV exportieren</a>
      </div>

      <div className="flex gap-2 px-5 pt-4 @min-[640px]:px-0 print:hidden" role="group" aria-label="Jahr">
        {[thisYear - 2, thisYear - 1, thisYear].map((y) => (
          <Link key={y} href={`${base}?year=${y}`} aria-pressed={y === year} aria-current={y === year ? "page" : undefined} className="chip">
            {y}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-3.5 @min-[640px]:gap-4 @min-[640px]:px-0 @min-[1024px]:grid-cols-4">
        {kpi("Einnahmen", chf(yearTotal), "Buchungen, Abos, Sponsoring", true)}
        {kpi("Mitglieder mit Abo", String(gv.members), `Vorjahr ${gv.membersPrev}`)}
        {kpi("Buchungen", String(gv.cur.bookings), `Vorjahr ${gv.prev.bookings}`)}
        {kpi("Offene Posten", chf(kasse.open), "vor Ort / Rechnung", false, kasse.open > 0)}
      </div>

      <div className="grid items-start gap-3.5 px-5 pt-3.5 @min-[640px]:gap-4 @min-[640px]:px-0 @min-[1024px]:grid-cols-2">
        <div className={card}>
          <h2 className={h2}>Einnahmen pro Monat <span className="text-[13px] font-semibold text-ink-3">CHF</span></h2>
          <div className="mt-8 flex h-[130px] items-end gap-1.5" role="img" aria-label={`Einnahmen pro Monat ${year}`}>
            {months.map((v, i) => (
              <div key={i} title={`${MONTHS[i]}: ${chf(v)}`} style={{ height: `${Math.round((v / maxM) * 100)}%` }} className={`relative min-h-px flex-1 rounded-[8px_8px_4px_4px] ${i === peak && v > 0 ? "bg-brand-deep" : "bg-brand-soft"}`}>
                {i === peak && v > 0 && <span className="absolute -top-[22px] left-1/2 -translate-x-1/2 text-[11.5px] font-semibold text-ink-3">{new Intl.NumberFormat("de-CH").format(Math.round(v))}</span>}
              </div>
            ))}
          </div>
          <div aria-hidden className="mt-1.5 flex gap-1.5">
            {MONTHS.map((m) => <span key={m} className="flex-1 text-center text-[11.5px] text-ink-3">{m[0]}</span>)}
          </div>
        </div>
        <div className={card}>
          <h2 className={h2}>Auslastung nach Platz</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            {a.courts.map((c) => (
              <div key={c.name} className="grid grid-cols-[72px_minmax(0,1fr)_40px] items-center gap-2.5 text-[13.5px] font-semibold">
                <span className="truncate">{c.name}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-brand-soft"><i className="block h-full rounded-full bg-brand-deep" style={{ width: `${Math.round(c.rate * 100)}%` }} /></span>
                <span className="text-right tabular-nums text-ink-2">{pct(c.rate)}</span>
              </div>
            ))}
            {!a.courts.length && <div className="text-[14px] text-ink-3">Noch keine Buchungen in diesem Jahr.</div>}
          </div>
        </div>
      </div>

      <nav className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4 @min-[640px]:px-0 print:hidden" aria-label="Abschnitte">
        {[["kasse", "Kasse"], ["auslastung", "Auslastung"], ["gv", "GV-Bericht"], ["pflege", "Mitgliederpflege"], ["junioren", "Junioren"], ["export", "Export"]].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="chip">
            {label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-3.5 px-5 pb-8 pt-4 @min-[640px]:gap-4 @min-[640px]:px-0">
        {/* 1. Kasse */}
        <section id="kasse" className={`${card} scroll-mt-4`}>
          <h2 className={h2}>Kassenjournal</h2>
          <p className={sub}>Bezahlte Buchungen nach Zahlungsdatum und Zahlart, dazu Abos und bezahlte Sponsoring-Rechnungen nach Zahlungsdatum. Aufladungen sind noch keine Einnahme (Verbindlichkeit), Einnahme entsteht mit der Buchung.</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 @min-[1024px]:grid-cols-4">
            <Tile label="Einnahmen total" value={chf(yearTotal)} hint="Buchungen + Abos + Sponsoring" />
            <Tile label="Offene Posten" value={chf(kasse.open)} hint="vor Ort / Rechnung unbezahlt" />
            <Tile label="Guthaben aufgeladen" value={chf(kasse.wallet.topUps)} hint={`genutzt ${chf(kasse.wallet.used)}`} />
            <Tile label="Guthaben-Saldo" value={chf(kasse.wallet.liability)} hint="Verbindlichkeit per heute" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}>Monat</th>
                  {METHODS.map((m) => <th key={m} className={`${th} text-right`}>{METHOD_LABEL[m]}</th>)}
                  <th className={`${th} text-right`}>Abos</th>
                  <th className={`${th} text-right`}>Sponsoring</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {kasse.months.map((m) => (
                  <tr key={m.m} className="border-b border-border last:border-0">
                    <td className={td}>{MONTHS[m.m - 1]}</td>
                    {METHODS.map((k) => <td key={k} className={`${td} text-right`}>{m.byMethod[k] ? chf(m.byMethod[k]) : "–"}</td>)}
                    <td className={`${td} text-right`}>{m.abos ? chf(m.abos) : "–"}</td>
                    <td className={`${td} text-right`}>{m.sponsoring ? chf(m.sponsoring) : "–"}</td>
                    <td className={`${td} text-right font-bold`}>{chf(monthTotal(m))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
            {kasse.byType.map(([k, v]) => (
              <span key={k}><span className="text-muted-foreground">{k}:</span> <b>{chf(v)}</b></span>
            ))}
            <span><span className="text-muted-foreground">Erlassen:</span> <b>{chf(kasse.waived)}</b></span>
            <span><span className="text-muted-foreground">Gutschriften Admin:</span> <b>{chf(kasse.wallet.grants)}</b></span>
          </div>
        </section>

        {/* 2. Auslastung */}
        <section id="auslastung" className={`${card} scroll-mt-4`}>
          <h2 className={h2}>Platzauslastung</h2>
          <p className={sub}>
            {a.first ? `Betrieb ${chDate(new Date(a.first))} – ${chDate(new Date(a.last))} (${a.activeDays} Tage), ${a.slotHours[0]}–${a.slotHours[a.slotHours.length - 1] + 1} Uhr. Anteil belegter Platzstunden.` : "Noch keine Buchungen in diesem Jahr."}
          </p>
          {a.first && (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="border-separate border-spacing-[2px]" aria-label="Auslastung nach Wochentag und Stunde">
                  <thead>
                    <tr>
                      <th />
                      {a.slotHours.map((h) => <th key={h} className="w-9 text-center text-[11px] font-semibold text-muted-foreground">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {a.heat.map((row, wd) => (
                      <tr key={wd}>
                        <th className="pr-1.5 text-left text-[12px] font-semibold text-muted-foreground">{WD[wd]}</th>
                        {row.map((v, i) => (
                          <td
                            key={i}
                            title={`${WD[wd]} ${a.slotHours[i]}:00 · ${pct(v)} belegt`}
                            className="h-8 w-9 rounded-[6px] text-center text-[11px] font-semibold tabular-nums"
                            style={{
                              background: v > 0 ? `color-mix(in srgb, var(--tennis-clay) ${Math.round(12 + Math.min(1, v) * 88)}%, var(--inset))` : "var(--inset)",
                              color: v > 0.55 ? "#fff" : "var(--muted-foreground)",
                            }}
                          >
                            {v >= 0.01 ? Math.round(v * 100) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-1.5 text-[12px] text-muted-foreground">Zahl = % belegt · dunkler = voller</div>
              <div className="mt-4 grid grid-cols-1 gap-4 @min-[1024px]:grid-cols-2">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={th}>Platz</th>
                      <th className={`${th} text-right`}>Stunden</th>
                      <th className={`${th} text-right`}>Auslastung</th>
                      <th className={`${th} text-right`}>Flutlicht</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.courts.map((c) => (
                      <tr key={c.name} className="border-b border-border last:border-0">
                        <td className={td}>{c.name}</td>
                        <td className={`${td} text-right`}>{c.hours}</td>
                        <td className={`${td} text-right font-bold`}>{pct(c.rate)}</td>
                        <td className={`${td} text-right`}>{c.light || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    {a.bySport.map(([k, v]) => <Tile key={k} label={`${k}-Stunden`} value={String(v)} />)}
                    <Tile label="Flutlicht-Stunden" value={String(a.lightHours)} />
                  </div>
                  <div className="text-[14px]">
                    <div className="font-bold">Gesperrte Stunden</div>
                    {a.blocked.length ? a.blocked.map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border py-1 last:border-0"><span>{k}</span><span className="tabular-nums">{v} h</span></div>
                    )) : <div className="text-muted-foreground">keine</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* 3. GV */}
        <section id="gv" className={`${card} scroll-mt-4`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className={h2}>Jahresbericht {year} für die GV</h2>
              <p className={sub}>Mitglieder per {chDate(gv.cut)}, Vergleich zu {year - 1}.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 @min-[1024px]:grid-cols-4">
            <Tile label="Mitglieder mit Abo" value={String(gv.members)} hint={`Vorjahr ${gv.membersPrev}`} />
            <Tile label="Eintritte" value={`+${gv.joined}`} />
            <Tile label="Austritte" value={`−${gv.left}`} />
            <Tile label="Gastspieler" value={String(gv.cur.guests)} hint={`Vorjahr ${gv.prev.guests}`} />
          </div>
          <table className="mt-4 w-full">
            <thead>
              <tr className="border-b border-border">
                <th className={th} />
                <th className={`${th} text-right`}>{year}</th>
                <th className={`${th} text-right`}>{year - 1}</th>
                <th className={`${th} text-right`}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["Buchungen", gv.cur.bookings, gv.prev.bookings, String],
                ["Spielstunden", gv.cur.hours, gv.prev.hours, String],
                ["Einnahmen Buchungen", gv.cur.bookingRevenue, gv.prev.bookingRevenue, chf],
                ["Einnahmen Abos", gv.cur.aboRevenue, gv.prev.aboRevenue, chf],
              ] as const).map(([label, c, p, f]) => (
                <tr key={label} className="border-b border-border last:border-0">
                  <td className={td}>{label}</td>
                  <td className={`${td} text-right font-bold`}>{f(c)}</td>
                  <td className={`${td} text-right`}>{f(p)}</td>
                  <td className={`${td} text-right`}><Delta cur={c} prev={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {gv.plans.length > 0 && (
            <div className="mt-4 text-[14px]">
              <div className="font-bold">Mitglieder nach Abo</div>
              {gv.plans.map(([p, n]) => (
                <div key={p} className="flex justify-between border-b border-border py-1 last:border-0"><span>{p}</span><span className="tabular-nums">{n}</span></div>
              ))}
            </div>
          )}
          <div className="mt-4 print:hidden"><PrintButton /></div>
        </section>

        {/* 4. Pflege */}
        <section id="pflege" className={`${card} scroll-mt-4`}>
          <h2 className={h2}>Mitgliederpflege</h2>
          <p className={sub}>Wer braucht einen Anruf? Stand heute.</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 @min-[1024px]:grid-cols-4">
            <Tile label="Inaktiv > 60 Tage" value={String(pflege.inactive.length)} hint="mit gültigem Abo" />
            <Tile label="Abo läuft in 30 Tagen ab" value={String(pflege.expiring.length)} hint="noch nicht verlängert" />
            <Tile label={`Stornoquote ${year}`} value={pct(pflege.cancelRate)} hint={`${pflege.cancelled} storniert`} />
            <Tile label={`Gäste → Mitglied ${year}`} value={`${pflege.converted} / ${pflege.guestsTotal}`} hint="neue Gäste, die ein Abo lösten" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 @min-[1024px]:grid-cols-3">
            <div className="text-[14px]">
              <div className="font-bold">Inaktiv</div>
              {pflege.inactive.slice(0, 15).map((m) => (
                <div key={m.email} className="flex justify-between gap-2 border-b border-border py-1 last:border-0">
                  <a href={`mailto:${m.email}`} className="truncate">{m.name}</a>
                  <span className="shrink-0 text-muted-foreground">{m.last ? chDate(m.last) : "nie"}</span>
                </div>
              ))}
              {pflege.inactive.length > 15 && <div className="pt-1 text-muted-foreground">und {pflege.inactive.length - 15} weitere, siehe Export Mitgliederliste</div>}
              {!pflege.inactive.length && <div className="text-muted-foreground">niemand</div>}
            </div>
            <div className="text-[14px]">
              <div className="font-bold">Abo läuft ab</div>
              {pflege.expiring.map((m) => (
                <div key={m.email} className="flex justify-between gap-2 border-b border-border py-1 last:border-0">
                  <a href={`mailto:${m.email}`} className="truncate">{m.name}</a>
                  <span className="shrink-0 text-muted-foreground">{chDate(m.endsAt)}</span>
                </div>
              ))}
              {!pflege.expiring.length && <div className="text-muted-foreground">niemand</div>}
            </div>
            <div className="text-[14px]">
              <div className="font-bold">Top-Spieler {year} (Stunden)</div>
              {pflege.top.map((m, i) => (
                <div key={m.name + i} className="flex justify-between gap-2 border-b border-border py-1 last:border-0">
                  <span className="truncate">{i + 1}. {m.name}</span>
                  <span className="shrink-0 tabular-nums">{m.hours}</span>
                </div>
              ))}
              {pflege.noShows.length > 0 && (
                <>
                  <div className="mt-3 font-bold">Nicht erschienen</div>
                  {pflege.noShows.map((m) => (
                    <div key={m.name} className="flex justify-between border-b border-border py-1 last:border-0"><span>{m.name}</span><span className="tabular-nums">{m.n}×</span></div>
                  ))}
                </>
              )}
            </div>
          </div>
        </section>

        {/* 5. Junioren */}
        <section id="junioren" className={`${card} scroll-mt-4`}>
          <h2 className={h2}>Junioren & Altersstruktur</h2>
          <p className={sub}>
            Für Gesuche bei Gemeinde/Kanton und die Meldung an Swiss Tennis. Alter = Jahrgang {year}.{" "}
            {j.withBirthDate < j.total && `${j.total - j.withBirthDate} von ${j.total} ohne Geburtsdatum – per Import (z.B. aus Fairgate) ergänzen.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 @min-[1024px]:grid-cols-4">
            <Tile label="Junioren (bis 18)" value={String(j.juniors)} />
            <Tile label="Junioren-Stunden" value={String(j.juniorHours)} hint="mind. 1 Junior auf dem Platz" />
            <Tile label="Trainer-Stunden" value={String(j.coachHours)} />
            <Tile label="Mitglieder total" value={String(j.total)} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}>Altersklasse</th>
                  <th className={`${th} text-right`}>männlich</th>
                  <th className={`${th} text-right`}>weiblich</th>
                  <th className={`${th} text-right`}>divers</th>
                  <th className={`${th} text-right`}>unbekannt</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {j.ages.filter((r) => r.M + r.F + r.X + r["?"] > 0 || r.cls !== AGE_CLASSES[AGE_CLASSES.length - 1]).map((r) => (
                  <tr key={r.cls} className="border-b border-border last:border-0">
                    <td className={td}>{r.cls}</td>
                    <td className={`${td} text-right`}>{r.M || "–"}</td>
                    <td className={`${td} text-right`}>{r.F || "–"}</td>
                    <td className={`${td} text-right`}>{r.X || "–"}</td>
                    <td className={`${td} text-right`}>{r["?"] || "–"}</td>
                    <td className={`${td} text-right font-bold`}>{r.M + r.F + r.X + r["?"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Export */}
        <section id="export" className={`${card} scroll-mt-4 print:hidden`}>
          <h2 className={h2}>Export {year}</h2>
          <p className={sub}>CSV mit Semikolon, UTF-8 und Datum TT.MM.JJJJ – öffnet direkt in Excel, Banana und Bexio. Den GV-Bericht oben als PDF drucken.</p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 @min-[640px]:grid-cols-2">
            {Object.entries(EXPORTS).map(([type, label]) => (
              <a
                key={type}
                href={`${base}/export?type=${type}&year=${year}`}
                download
                className="btn btn-ghost justify-between"
              >
                {label}
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
