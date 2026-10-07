import { getCourtsByTenantId, getMembershipPlansByTenantId } from "@/lib/data";
import { cancelDeadlineMinutes } from "@/lib/booking-rules";
import { parseAddress } from "@/lib/sponsoring";
import type { Tenant, TenantSettings } from "@/types";

export type SettingsGroups = [string, [string, string, string, string?][]][];

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const mins = (m: number) => (m % 60 === 0 ? `${m / 60} Std.` : `${m} Min.`);

/** Settings topics with their current state, for the list (phone: own page, desktop: left column). */
export async function settingsOverview(tenant: Tenant) {
  const s: Partial<TenantSettings> = tenant.settingsJson ?? {};

  const [courts, plans] = await Promise.all([getCourtsByTenantId(tenant.id), getMembershipPlansByTenantId(tenant.id)]);
  const active = courts.filter((c) => c.status === "ACTIVE").length;
  const maint = courts.filter((c) => c.status === "MAINTENANCE").length;
  const missing = [!s.invoiceIban && "IBAN", !parseAddress(tenant.address) && "Clubadresse"].filter(Boolean) as string[];
  const pay = ["Online", s.payOnSite && "vor Ort", s.payByInvoice && "auf Rechnung"].filter(Boolean).join(", ");
  const rules = s.priceRules?.length ?? 0;

  const base = `/c/${tenant.slug}/admin/settings`;
  const groups: SettingsGroups = [
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
  return { base, missing, groups };
}
