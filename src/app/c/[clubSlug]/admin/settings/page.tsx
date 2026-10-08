import Link from "next/link";
import { requireTenantAdmin } from "@/lib/tenant";
import { getCourtsByTenantId, getMembershipPlansByTenantId } from "@/lib/data";
import { cancelDeadlineMinutes } from "@/lib/booking-rules";
import { parseAddress } from "@/lib/sponsoring";
import type { TenantSettings } from "@/types";

interface ClubSettingsPageProps {
  params: Promise<{
    clubSlug: string;
  }>;
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const mins = (m: number) => (m % 60 === 0 ? `${m / 60} Std.` : `${m} Min.`);

export default async function ClubSettingsPage({ params }: ClubSettingsPageProps) {
  const { clubSlug } = await params;
  const { tenant } = await requireTenantAdmin(clubSlug);
  const s: Partial<TenantSettings> = tenant.settingsJson ?? {};

  const [courts, plans] = await Promise.all([getCourtsByTenantId(tenant.id), getMembershipPlansByTenantId(tenant.id)]);
  const active = courts.filter((c) => c.status === "ACTIVE").length;
  const maint = courts.filter((c) => c.status === "MAINTENANCE").length;
  const missing = [!s.invoiceIban && "IBAN", !parseAddress(tenant.address) && "Clubadresse"].filter(Boolean) as string[];
  const pay = ["Online", s.payOnSite && "vor Ort", s.payByInvoice && "auf Rechnung"].filter(Boolean).join(", ");
  const rules = s.priceRules?.length ?? 0;

  const base = `/c/${tenant.slug}/admin/settings`;
  const groups: [string, [string, string, string, string?][]][] = [
    ["Anlage", [
      ["plaetze", "Plätze", `${active} bespielbar${maint ? ` · ${maint} in Wartung` : ""}`],
      ["oeffnung", "Öffnungszeiten", `${hh(s.openingHour ?? 7)}–${hh(s.closingHour ?? 22)} Uhr`],
    ]],
    ["Mitglieder", [
      ["abos", "Abos", `${plans.length} ${plans.length === 1 ? "Abo" : "Abos"}`],
      ["regeln", "Buchungsregeln", `Gratis stornieren bis ${mins(cancelDeadlineMinutes(tenant.settingsJson))} vorher · Fairplay ${s.marlyRuleEnabled === false ? "aus" : "an"}`],
    ]],
    ["Geld", [
      ["preise", "Preise & Rabatte", rules ? `${rules} ${rules === 1 ? "Preisregel" : "Preisregeln"}` : "Keine Preisregeln"],
      ["zahlungen", "Zahlungen & Rechnungen", pay, missing.length ? `${missing.join(" + ")} fehlt` : undefined],
    ]],
    ["Club", [
      ["aussehen", "Aussehen", "Name, Farbe, Logo"],
      ["gaeste", "Gäste & Demo", `Gastbuchungen ${s.allowGuestBookings === false ? "aus" : "an"} · Demo ${s.demoMode ? "an" : "aus"}`],
    ]],
  ];

  return (
    <>
      <div className="px-5 pt-3 @min-[640px]:px-0 @min-[640px]:pt-0">
        <h1 className="text-[28px] font-bold tracking-[-.03em]">Einstellungen</h1>
        <div className="mt-0.5 text-[15px] text-muted-foreground">{tenant.name}</div>
      </div>

      <div className="flex max-w-[720px] flex-col gap-2 px-5 pb-8 pt-4 @min-[640px]:px-0">
        {missing.length > 0 && (
          <Link href={`${base}/zahlungen#rechnungsdaten`} className="mb-2 flex items-center gap-3 rounded-[18px] bg-warn-bg px-4 py-3 text-[14px] text-warn">
            <span className="flex-1">{missing.join(" und ")} {missing.length > 1 ? "fehlen" : "fehlt"}. Rechnungen zeigen darum einen Muster-QR.</span>
            <b className="shrink-0">Ergänzen ›</b>
          </Link>
        )}
        {groups.map(([title, rows]) => (
          <section key={title} className="flex flex-col gap-2">
            <h2 className="mt-2 px-1 text-[12px] font-bold uppercase tracking-[.06em] text-ink-3">{title}</h2>
            <div className="card overflow-hidden">
              {rows.map(([id, name, sub, warn]) => (
                <Link key={id} href={`${base}/${id}`} className="flex min-h-[64px] items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px]">{name}</b>
                    <small className="block truncate text-[13px] text-ink-3">{sub}</small>
                  </span>
                  {warn && <span className="pill shrink-0 bg-warn-bg text-warn">{warn}</span>}
                  <span aria-hidden className="text-[20px] text-ink-3">›</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
