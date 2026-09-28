import Link from "next/link";
import { FreeSlots } from "@/components/app/free-slots";
import { Chevron, Dot } from "@/components/app/avatar";
import {
  getBlocksInRange,
  getBookingsInRange,
  getCourtsByTenantId,
  getMembershipPlansByTenantId,
  getTenantBySlug,
} from "@/lib/data";
import { courtColor, courtLabel, SURFACE_LABEL, surfaceKind } from "@/lib/courts";

export const dynamic = "force-dynamic";

const SLUG = "tc-marly";
const base = `/c/${SLUG}`;
const label = "text-[13px] font-bold uppercase tracking-[.06em] text-muted-foreground";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Next three days plus one day of slack either side, which covers any client timezone offset. */
function window3Days() {
  const from = new Date(Date.now() - 86_400_000);
  from.setUTCHours(0, 0, 0, 0);
  return { from, to: new Date(from.getTime() + 5 * 86_400_000) };
}

export default async function Home() {
  const tenant = await getTenantBySlug(SLUG);

  if (!tenant) {
    return (
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-16">
        <h1 className="text-[42px] font-bold leading-[1.02] tracking-[-.035em]">Gerade nicht erreichbar.</h1>
        <p className="mt-3 text-[16px] text-muted-foreground">Die Clubdaten konnten nicht geladen werden. Bitte versuche es später noch einmal.</p>
      </main>
    );
  }

  const { from, to } = window3Days();
  const [allCourts, plans, bookings, blocks] = await Promise.all([
    getCourtsByTenantId(tenant.id),
    getMembershipPlansByTenantId(tenant.id),
    getBookingsInRange(tenant.id, from.toISOString(), to.toISOString()),
    getBlocksInRange(tenant.id, from.toISOString(), to.toISOString()),
  ]);
  const courts = allCourts.filter((c) => c.status === "ACTIVE").sort((a, b) => a.sortOrder - b.sortOrder);

  const settings = tenant.settingsJson;
  const open = settings?.openingHour ?? 7;
  const close = settings?.closingHour ?? 22;
  const club = tenant.name.replace(/^Tennis Club /, "TC ");
  const counts = courts.reduce<Record<string, number>>((acc, c) => ({ ...acc, [surfaceKind(c)]: (acc[surfaceKind(c)] ?? 0) + 1 }), {});
  const surfaces = (["clay", "hard", "padel"] as const)
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${SURFACE_LABEL[k]}`)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-[1200px] pb-[max(32px,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-4 px-5 pb-2 pt-[max(16px,env(safe-area-inset-top))] lg:px-10 lg:pt-7">
        <Link href="/" className="mr-auto text-[20px] font-bold tracking-[-.03em]">
          {club}
        </Link>
        <Link href={`${base}/profile`} className="text-[15px] font-semibold text-clay-text">
          Anmelden
        </Link>
        <Link
          href={`${base}/calendar`}
          className="flex h-[42px] items-center rounded-[14px] bg-clay px-4 text-[15px] font-bold text-white"
        >
          Platz buchen
        </Link>
      </header>

      <main>
        <section className="pt-10 lg:grid lg:grid-cols-[1fr_minmax(0,560px)] lg:items-end lg:gap-14 lg:px-10 lg:pt-24">
          <div className="px-5 lg:px-0">
            <h1 className="text-[56px] font-bold leading-[.98] tracking-[-.05em] lg:text-[80px] lg:tracking-[-.055em]">
              Platz frei?
              <br />
              <span className="text-muted-foreground">Schau selbst.</span>
            </h1>
            <p className="mt-4 text-[17px] leading-[1.4] text-muted-foreground">
              {courts.length} Plätze · {surfaces}
              <br />
              Geöffnet {open}–{close} Uhr
            </p>
          </div>

          <div className="pt-9 lg:pt-0">
            <div className="flex items-baseline justify-between px-5 pb-3 lg:px-0">
              <h2 className="text-[22px] font-bold tracking-[-.02em]">Jetzt frei</h2>
              <Link href={`${base}/calendar`} className="text-[15px] font-semibold text-clay-text">
                Alle Zeiten
              </Link>
            </div>
            <FreeSlots href={`${base}/calendar`} courts={courts} bookings={bookings} blocks={blocks} open={open} close={close} />
          </div>
        </section>

        <section className="px-5 pt-14 lg:px-10 lg:pt-28">
          <h2 className="text-[34px] font-bold tracking-[-.035em]">Plätze</h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
            {courts.map((c) => {
              const l = courtLabel(c);
              return (
                <li key={c.id} className="flex items-center gap-2.5 rounded-[20px] border border-border bg-card px-3.5 py-3 lg:gap-3 lg:rounded-[22px] lg:px-[18px] lg:py-4">
                  <Dot color={courtColor(c)} size={10} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-bold tracking-[-.01em]">{l.name}</div>
                    <div className="truncate text-[14px] text-muted-foreground">{l.sub}</div>
                  </div>
                  {c.hasLighting && (
                    <svg role="img" aria-label="Flutlicht" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {(plans.length > 0 || settings?.allowGuestBookings) && (
          <section className="px-5 pt-14 lg:px-10 lg:pt-24">
            <h2 className="text-[34px] font-bold tracking-[-.035em]">Abos</h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <Link
                  key={p.id}
                  href={`${base}/profile?abo=1`}
                  className="flex flex-col rounded-[26px] border border-border bg-card p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 text-[20px] font-bold tracking-[-.02em]">{p.name}</div>
                    <Chevron className="mt-1" />
                  </div>
                  {p.description && <p className="mt-1 text-[15px] leading-[1.4] text-muted-foreground">{p.description}</p>}
                  <div className="mt-auto pt-5 text-[28px] font-bold tracking-[-.03em]">
                    <span className="text-[15px] font-semibold text-muted-foreground">CHF </span>
                    {fmt(p.price)}
                  </div>
                </Link>
              ))}
            </div>
            {settings?.allowGuestBookings && (
              <div className="mt-3 rounded-[22px] bg-inset px-[18px] py-4 text-[15px] leading-[1.45] text-muted-foreground">
                Ohne Abo? Als Gast buchst du einzelne Stunden und zahlst mit Twint.
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="mx-5 mt-16 border-t border-border pt-6 text-[14px] leading-[1.6] text-muted-foreground lg:mx-10">
        <div className={label}>{tenant.name}</div>
        {tenant.address && <div className="mt-2">{tenant.address}</div>}
        {tenant.email && (
          <a href={`mailto:${tenant.email}`} className="block text-clay-text">
            {tenant.email}
          </a>
        )}
        {tenant.phone && (
          <a href={`tel:${tenant.phone.replace(/\s+/g, "")}`} className="block text-clay-text">
            {tenant.phone}
          </a>
        )}
      </footer>
    </div>
  );
}
