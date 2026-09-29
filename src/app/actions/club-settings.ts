"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  getTenantBySlug,
  updateTenantSettings,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
  getMembershipPlansByTenantId,
} from "@/lib/data";
import { PriceRule, TenantRole, TenantSettings } from "@/types";
import { prisma } from "@/lib/prisma";
import { LIMIT_ROLES, SPORTS } from "@/lib/booking-rules";

function cleanSlotLimits(v: TenantSettings["slotLimits"]): TenantSettings["slotLimits"] {
  const out: NonNullable<TenantSettings["slotLimits"]> = {};
  for (const [role] of LIMIT_ROLES) {
    const row = v?.[role];
    if (!row) continue;
    out[role] = {};
    for (const [sport] of SPORTS) {
      const n = row[sport];
      out[role]![sport] = n == null || !Number.isFinite(Number(n)) ? null : Math.max(0, Math.min(50, Math.round(Number(n))));
    }
  }
  return out;
}

const num = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? undefined : Number(v));

function cleanPriceRules(rules: PriceRule[] | undefined): PriceRule[] | string {
  const out: PriceRule[] = [];
  for (const r of rules ?? []) {
    const percent = Number(r.percent);
    if (!r.label?.trim() || !Number.isFinite(percent) || percent < -100 || percent > 200) {
      return "Jede Preisregel braucht einen Namen und einen Prozentwert zwischen -100 und 200.";
    }
    const weekdays = (r.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    out.push({
      label: r.label.trim().slice(0, 40),
      percent,
      ...(weekdays.length ? { weekdays } : {}),
      ...(num(r.fromHour) != null ? { fromHour: num(r.fromHour) } : {}),
      ...(num(r.toHour) != null ? { toHour: num(r.toHour) } : {}),
      ...(num(r.minLeadHours) != null ? { minLeadHours: num(r.minLeadHours) } : {}),
      ...(num(r.maxLeadHours) != null ? { maxLeadHours: num(r.maxLeadHours) } : {}),
    });
  }
  return out.slice(0, 20);
}

async function verifyClubAdmin(clubSlug: string) {
  const session = await auth();
  if (!session?.user) {
    return { authorized: false, error: "Bitte melde dich an." };
  }

  const isPlatformAdmin = Boolean(
    session.user.isPlatformAdmin || session.user.role === "PLATFORM_ADMIN"
  );
  // session.user.role is only ever the role from the user's FIRST tenant membership
  // (see auth.ts primaryRole) — never trust it as a global "is admin somewhere" flag.
  // Only a per-tenant match against this exact clubSlug proves authorization here.
  const isClubAdmin =
    isPlatformAdmin ||
    session.user.tenants?.some(
      (t) => t.slug === clubSlug && t.role === "CLUB_ADMIN"
    );

  if (!isClubAdmin) {
    return {
      authorized: false,
      error: "Keine Berechtigung zur Verwaltung dieses Clubs.",
    };
  }

  const tenant = await getTenantBySlug(clubSlug);
  if (!tenant) {
    return { authorized: false, error: "Club nicht gefunden." };
  }

  return { authorized: true, tenant, session };
}

export async function updateClubSettingsAction(
  clubSlug: string,
  settings: Partial<TenantSettings>
) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) {
    return { success: false, error: authCheck.error };
  }

  // Input validation
  const opening = Number(settings.openingHour ?? 7);
  const closing = Number(settings.closingHour ?? 22);
  const slotDuration = Number(settings.slotDurationMinutes ?? 60);
  const cancellationDeadline = Number(settings.cancellationDeadlineHours ?? 24);

  if (opening < 5 || opening > 12) {
    return {
      success: false,
      error: "Öffnungszeit muss zwischen 05:00 und 12:00 Uhr liegen.",
    };
  }
  if (closing < 18 || closing > 24) {
    return {
      success: false,
      error: "Schliesszeit muss zwischen 18:00 und 24:00 Uhr liegen.",
    };
  }
  if (closing <= opening) {
    return {
      success: false,
      error: "Die Schliesszeit muss nach der Öffnungszeit liegen.",
    };
  }
  if (![30, 45, 60, 90, 120].includes(slotDuration)) {
    return {
      success: false,
      error: "Slot-Dauer muss 30, 45, 60, 90 oder 120 Minuten sein.",
    };
  }
  if (cancellationDeadline < 0) {
    return {
      success: false,
      error: "Stornierungsfrist darf nicht negativ sein.",
    };
  }

  const priceRules = cleanPriceRules(settings.priceRules);
  if (typeof priceRules === "string") return { success: false, error: priceRules };
  const late = Number(settings.lateBookingMinutes ?? 15);
  if (!(late >= 0 && late <= 120)) {
    return { success: false, error: "Buchen nach Spielbeginn: 0 bis 120 Minuten." };
  }

  const updated = await updateTenantSettings(clubSlug, {
    slotLimits: cleanSlotLimits(settings.slotLimits),
    lateBookingMinutes: late,
    payOnSite: Boolean(settings.payOnSite),
    payByInvoice: Boolean(settings.payByInvoice),
    priceRules,
    openingHour: opening,
    closingHour: closing,
    slotDurationMinutes: slotDuration,
    cancellationDeadlineHours: cancellationDeadline,
    allowGuestBookings: Boolean(settings.allowGuestBookings),
    allowConsecutiveSlotsForDoubles: settings.allowConsecutiveSlotsForDoubles ?? true,
    marlyRuleEnabled: settings.marlyRuleEnabled ?? true,
    marlyCooldownMinutes: Number(settings.marlyCooldownMinutes ?? 60),
    maxActiveSlotsPerPlayer: Number(settings.maxActiveSlotsPerPlayer ?? 2),
    ballMachineAvailable: settings.ballMachineAvailable ?? true,
    ballMachineFee: Number(settings.ballMachineFee ?? 10),
    floodlightFee: Number(settings.floodlightFee ?? 5),
    guestFee: Number(settings.guestFee ?? 15),
    defaultHourlyRateTennis: Number(settings.defaultHourlyRateTennis ?? 30),
    defaultHourlyRateHalle: Number(settings.defaultHourlyRateHalle ?? 45),
    defaultHourlyRatePadel: Number(settings.defaultHourlyRatePadel ?? 40),
  });

  if (!updated) {
    return { success: false, error: "Fehler beim Speichern der Club-Einstellungen." };
  }

  revalidatePath(`/c/${clubSlug}`);
  revalidatePath(`/c/${clubSlug}/admin`);
  return { success: true, settings: updated.settingsJson };
}

export interface CreateMembershipPlanInput {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  bookingWindowDays: number;
  simultaneousBookingLimit: number;
  dailyBookingLimit: number;
  weeklyBookingLimit: number;
  allowedDurations: number[];
  guestsPerWeek?: number | null;
}

export async function createMembershipPlanAction(
  clubSlug: string,
  input: CreateMembershipPlanInput
) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) {
    return { success: false, error: authCheck.error };
  }

  if (!input.name || input.name.trim().length === 0) {
    return { success: false, error: "Tarifname ist erforderlich." };
  }
  if (input.price < 0) {
    return { success: false, error: "Preis darf nicht negativ sein." };
  }
  if (input.bookingWindowDays < 1) {
    return { success: false, error: "Buchungsfenster muss mindestens 1 Tag betragen." };
  }
  if (input.simultaneousBookingLimit < 1) {
    return { success: false, error: "Gleichzeitiges Buchungslimit muss mind. 1 sein." };
  }

  const plan = await createMembershipPlan(authCheck.tenant.id, {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    price: Number(input.price),
    currency: input.currency || "CHF",
    bookingWindowDays: Number(input.bookingWindowDays),
    simultaneousBookingLimit: Number(input.simultaneousBookingLimit),
    dailyBookingLimit: Number(input.dailyBookingLimit || 1),
    weeklyBookingLimit: Number(input.weeklyBookingLimit || 4),
    allowedDurations:
      input.allowedDurations && input.allowedDurations.length > 0
        ? input.allowedDurations
        : [60],
    guestsPerWeek: input.guestsPerWeek == null ? null : Math.max(0, Math.round(Number(input.guestsPerWeek))),
  });

  revalidatePath(`/c/${clubSlug}/admin`);
  return { success: true, plan };
}

export async function updateMembershipPlanAction(
  clubSlug: string,
  planId: string,
  input: Partial<CreateMembershipPlanInput>
) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) {
    return { success: false, error: authCheck.error };
  }

  // A club admin must never be able to modify another tenant's plan by id alone.
  const tenantPlans = await getMembershipPlansByTenantId(authCheck.tenant.id);
  if (!tenantPlans.some((p) => p.id === planId)) {
    return { success: false, error: "Tarif gehört nicht zu diesem Club." };
  }

  const updated = await updateMembershipPlan(planId, input);
  if (!updated) {
    return { success: false, error: "Tarif konnte nicht aktualisiert werden." };
  }

  revalidatePath(`/c/${clubSlug}/admin`);
  return { success: true, plan: updated };
}

export async function deleteMembershipPlanAction(
  clubSlug: string,
  planId: string
) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) {
    return { success: false, error: authCheck.error };
  }

  // A club admin must never be able to delete another tenant's plan by id alone.
  const tenantPlans = await getMembershipPlansByTenantId(authCheck.tenant.id);
  if (!tenantPlans.some((p) => p.id === planId)) {
    return { success: false, error: "Tarif gehört nicht zu diesem Club." };
  }

  const deleted = await deleteMembershipPlan(planId);
  if (!deleted) {
    return { success: false, error: "Tarif konnte nicht gelöscht werden." };
  }

  revalidatePath(`/c/${clubSlug}/admin`);
  return { success: true };
}

const ASSIGNABLE_ROLES: TenantRole[] = ["MEMBER", "COACH", "GUEST", "CLUB_ADMIN"];

export async function setMemberRoleAction(clubSlug: string, userId: string, role: TenantRole) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) {
    return { success: false, error: authCheck.error };
  }
  if (!ASSIGNABLE_ROLES.includes(role)) return { success: false, error: "Ungültige Rolle." };
  if (userId === authCheck.session?.user.id) {
    return { success: false, error: "Die eigene Rolle kann nicht geändert werden." };
  }
  const r = await prisma.tenantUser.updateMany({
    where: { tenantId: authCheck.tenant.id, userId, role: { not: "PLATFORM_ADMIN" } },
    data: { role },
  });
  if (!r.count) return { success: false, error: "Mitglied nicht gefunden." };
  revalidatePath(`/c/${clubSlug}/admin`, "layout");
  return { success: true };
}
