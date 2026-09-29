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
import { PriceRule, SportType, TenantRole, TenantSettings } from "@/types";
import { prisma } from "@/lib/prisma";
import { LIMIT_ROLES, SPORTS } from "@/lib/booking-rules";
import { ensureDemoAccounts, purgeDemoData } from "@/lib/demo";
import { parseMembers } from "@/lib/member-import";
import { passwordLink } from "@/lib/booking-link";
import { sendPasswordLink, sendRenewalReminder } from "@/lib/mail";
import { grantMembership, isPartnerRow, seasonEnd } from "@/lib/membership";
import { isValidIban } from "@/lib/iban";
import { parseDate } from "@/lib/member-import";

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
  const cancellationDeadline = Math.round(Number(settings.cancellationDeadlineMinutes ?? (settings.cancellationDeadlineHours ?? 24) * 60));

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
  if (!Number.isFinite(cancellationDeadline) || cancellationDeadline < 0 || cancellationDeadline > 14 * 24 * 60) {
    return {
      success: false,
      error: "Stornierungsfrist muss zwischen 0 Minuten und 14 Tagen liegen.",
    };
  }

  const priceRules = cleanPriceRules(settings.priceRules);
  if (typeof priceRules === "string") return { success: false, error: priceRules };
  const d = settings.dinerTennis;
  const dinerTennis = d && {
    enabled: Boolean(d.enabled),
    weekdays: [...new Set((d.weekdays ?? []).map(Number))].filter((x) => Number.isInteger(x) && x >= 0 && x <= 6),
    fromHour: Number(d.fromHour),
    toHour: Number(d.toHour),
  };
  if (dinerTennis && !(Number.isInteger(dinerTennis.fromHour) && Number.isInteger(dinerTennis.toHour) && dinerTennis.fromHour >= 0 && dinerTennis.fromHour < dinerTennis.toHour && dinerTennis.toHour <= 24)) {
    return { success: false, error: "Diner Tennis: Von muss vor Bis liegen (0 bis 24 Uhr)." };
  }
  if (dinerTennis?.enabled && !dinerTennis.weekdays.length) {
    return { success: false, error: "Diner Tennis: mindestens einen Wochentag wählen." };
  }
  const late = Number(settings.lateBookingMinutes ?? 15);
  if (!(late >= 0 && late <= 120)) {
    return { success: false, error: "Buchen nach Spielbeginn: 0 bis 120 Minuten." };
  }

  // Demo mode on: create/repair the personas first, so the role switcher works right away (idempotent)
  const demoMode = Boolean(settings.demoMode);
  if (demoMode && process.env.DATABASE_URL) {
    try {
      await ensureDemoAccounts(authCheck.tenant.id);
    } catch (e) {
      console.error("ensureDemoAccounts failed:", e);
      return { success: false, error: "Demo-Konten konnten nicht angelegt werden." };
    }
  }

  const invoiceIban = (settings.invoiceIban ?? "").replace(/\s+/g, "").toUpperCase();
  if (invoiceIban && !isValidIban(invoiceIban)) return { success: false, error: "Die IBAN ist ungültig (Prüfziffer stimmt nicht)." };

  const updated = await updateTenantSettings(clubSlug, {
    demoMode,
    slotLimits: cleanSlotLimits(settings.slotLimits),
    lateBookingMinutes: late,
    payOnSite: Boolean(settings.payOnSite),
    payByInvoice: Boolean(settings.payByInvoice),
    invoiceIban,
    invoiceBank: (settings.invoiceBank ?? "").trim().slice(0, 80),
    priceRules,
    ...(dinerTennis && { dinerTennis }),
    openingHour: opening,
    closingHour: closing,
    slotDurationMinutes: slotDuration,
    cancellationDeadlineMinutes: cancellationDeadline,
    cancellationDeadlineHours: Math.ceil(cancellationDeadline / 60), // legacy readers
    allowGuestBookings: Boolean(settings.allowGuestBookings),
    allowConsecutiveSlotsForDoubles: settings.allowConsecutiveSlotsForDoubles ?? true,
    marlyRuleEnabled: settings.marlyRuleEnabled ?? true,
    marlyCooldownMinutes: Number(settings.marlyCooldownMinutes ?? 60),
    maxActiveSlotsPerPlayer: Number(settings.maxActiveSlotsPerPlayer ?? 2),
    ballMachineAvailable: settings.ballMachineAvailable ?? true,
    ballMachineFee: Number(settings.ballMachineFee ?? 10),
    floodlightFee: Number(settings.floodlightFee ?? 0),
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
  sports?: SportType[];
  category?: string | null;
  persons?: 1 | 2;
  ageMin?: number | null;
  ageMax?: number | null;
  proofRequired?: boolean;
  playWindow?: { weekdays: number[]; fromHour: number; toHour: number } | null;
}

/** Validates/cleans the rulesJson extras; only keys present in `input` are returned. */
function cleanPlanExtras(input: Partial<CreateMembershipPlanInput>): { error: string } | { extras: Partial<CreateMembershipPlanInput> } {
  const extras: Partial<CreateMembershipPlanInput> = {};
  if (input.sports !== undefined) {
    const sports = [...new Set(input.sports)];
    if (!sports.length || sports.some((s) => s !== "TENNIS" && s !== "PADEL")) return { error: "Mindestens eine Sportart (Tennis/Padel) wählen." };
    extras.sports = sports;
  }
  if (input.category !== undefined) {
    const c = input.category?.trim() || null;
    if (c && c.length > 40) return { error: "Kategorie darf höchstens 40 Zeichen haben." };
    extras.category = c;
  }
  if (input.persons !== undefined) {
    if (input.persons !== 1 && input.persons !== 2) return { error: "Personen muss 1 oder 2 sein." };
    extras.persons = input.persons;
  }
  for (const k of ["ageMin", "ageMax"] as const) {
    const v = input[k];
    if (v === undefined) continue;
    if (v !== null && (!Number.isInteger(v) || v < 0 || v > 120)) return { error: "Alter muss zwischen 0 und 120 liegen." };
    extras[k] = v;
  }
  if (extras.ageMin != null && extras.ageMax != null && extras.ageMin > extras.ageMax) {
    return { error: "\"Alter ab\" darf nicht grösser als \"Alter bis\" sein." };
  }
  if (input.proofRequired !== undefined) extras.proofRequired = Boolean(input.proofRequired);
  if (input.playWindow !== undefined) {
    const w = input.playWindow;
    if (w) {
      const days = [...new Set(w.weekdays)];
      if (!days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { error: "Spielzeiten: mindestens einen gültigen Wochentag wählen." };
      if (!Number.isInteger(w.fromHour) || !Number.isInteger(w.toHour) || w.fromHour < 0 || w.toHour > 24 || w.fromHour >= w.toHour) {
        return { error: "Spielzeiten: \"von\" muss vor \"bis\" liegen (0–24 Uhr)." };
      }
      extras.playWindow = { weekdays: days, fromHour: w.fromHour, toHour: w.toHour };
    } else extras.playWindow = null;
  }
  return { extras };
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
  const cleaned = cleanPlanExtras(input);
  if ("error" in cleaned) return { success: false, error: cleaned.error };

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
    ...cleaned.extras,
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

  const cleaned = cleanPlanExtras(input);
  if ("error" in cleaned) return { success: false, error: cleaned.error };
  if (input.name !== undefined && !input.name.trim()) return { success: false, error: "Tarifname ist erforderlich." };
  if (input.price !== undefined && !(input.price >= 0)) return { success: false, error: "Preis darf nicht negativ sein." };

  const updated = await updateMembershipPlan(planId, { ...input, ...cleaned.extras });
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

const MAX_IMPORT = 2000;
const MAX_INVITES = 250; // Brevo free tier: 300 mails/day

export async function importMembersAction(clubSlug: string, text: string, sendInvites: boolean) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) {
    return { success: false as const, error: authCheck.error };
  }
  if (!process.env.DATABASE_URL) {
    return { success: false as const, error: "Der Import braucht eine Datenbank." };
  }
  if (typeof text !== "string" || text.length > 2_000_000) {
    return { success: false as const, error: "Die Datei ist zu gross." };
  }
  const { rows, errors } = parseMembers(text);
  if (!rows.length) return { success: false as const, error: "Keine gültigen Zeilen gefunden." };
  if (rows.length > MAX_IMPORT) {
    return { success: false as const, error: `Maximal ${MAX_IMPORT} Mitglieder pro Import.` };
  }

  const tenant = authCheck.tenant;
  const emails = rows.map((r) => r.email);
  const known = new Set(
    (await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((u) => u.email)
  );
  // New accounts get no password; existing users keep their name and password.
  const fresh = rows.filter((r) => !known.has(r.email));
  const created = (
    await prisma.user.createMany({
      data: fresh.map((r) => ({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        phone: r.phone ?? null,
        birthDate: r.birthDate ? new Date(r.birthDate) : null,
        gender: r.gender ?? null,
      })),
      skipDuplicates: true,
    })
  ).count;
  // existing users: only fill birth date / gender where still empty (age stats)
  const fill = rows.filter((r) => known.has(r.email));
  await prisma.$transaction([
    ...fill.filter((r) => r.birthDate).map((r) =>
      prisma.user.updateMany({ where: { email: r.email, birthDate: null }, data: { birthDate: new Date(r.birthDate!) } })
    ),
    ...fill.filter((r) => r.gender).map((r) =>
      prisma.user.updateMany({ where: { email: r.email, gender: null }, data: { gender: r.gender } })
    ),
  ]);

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, firstName: true, passwordHash: true, tenantUsers: { where: { tenantId: tenant.id }, select: { role: true } } },
  });
  const missing = users.filter((u) => !u.tenantUsers.length);
  const guests = users.filter((u) => u.tenantUsers[0]?.role === "GUEST");
  await prisma.$transaction([
    prisma.tenantUser.createMany({
      data: missing.map((u) => ({ tenantId: tenant.id, userId: u.id, role: "MEMBER" as const })),
      skipDuplicates: true,
    }),
    // GUEST -> MEMBER only; other roles are never touched.
    prisma.tenantUser.updateMany({
      where: { tenantId: tenant.id, userId: { in: guests.map((u) => u.id) }, role: "GUEST" },
      data: { role: "MEMBER" },
    }),
  ]);
  const updated = [...missing, ...guests].filter((u) => known.has(u.email)).length;
  const unchanged = rows.length - created - updated;

  let invited = 0;
  let inviteFailed = 0;
  let invitesSkipped = 0;
  if (sendInvites) {
    const targets = users.filter((u) => !u.passwordHash);
    invitesSkipped = Math.max(0, targets.length - MAX_INVITES);
    const batch = targets.slice(0, MAX_INVITES);
    for (let i = 0; i < batch.length; i += 10) {
      const sent = await Promise.all(
        batch.slice(i, i + 10).map((u) =>
          sendPasswordLink(u.email, u.firstName, tenant.name, passwordLink(tenant.slug, u.id, null), "invite").catch(() => false)
        )
      );
      invited += sent.filter(Boolean).length;
      inviteFailed += sent.filter((ok) => !ok).length;
    }
  }

  const result = { created, updated, unchanged, invited, inviteFailed, invitesSkipped, errors };
  await prisma.auditLog
    .create({
      data: {
        tenantId: tenant.id,
        actorId: authCheck.session?.user.id ?? null,
        action: "MEMBERS_IMPORTED",
        entityType: "Tenant",
        entityId: tenant.id,
        metadataJson: { ...result, rows: rows.length, errors: errors.length },
      },
    })
    .catch((e) => console.error("[importMembersAction] audit log failed", e));

  revalidatePath(`/c/${clubSlug}/admin`, "layout");
  return { success: true as const, ...result };
}

/** Admin → Einstellungen: remove all demo bookings/blocks/wallet history of this club (see purgeDemoData). */
export async function purgeDemoDataAction(clubSlug: string) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  if (!process.env.DATABASE_URL) return { success: false as const, error: "Datenbank nicht verbunden." };
  const r = await purgeDemoData(authCheck.tenant.id);
  revalidatePath(`/c/${clubSlug}`, "layout");
  return { success: true as const, ...r };
}

const HEX = /^#[0-9a-f]{6}$/i;
const LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Club color, logo and booking colors. `logo`: data URL to set, null to remove, undefined to keep. */
export async function updateClubBrandingAction(
  clubSlug: string,
  brandColor: string | null,
  logo?: string | null,
  bookingColors?: TenantSettings["bookingColors"]
) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  if (!process.env.DATABASE_URL) return { success: false as const, error: "Branding braucht eine Datenbank." };
  if (brandColor !== null && !HEX.test(brandColor)) return { success: false as const, error: "Ungültige Farbe." };
  const roleColors = Object.entries(bookingColors ?? {});
  if (roleColors.some(([k, v]) => !["MEMBER", "GUEST", "COACH"].includes(k) || !HEX.test(v ?? ""))) {
    return { success: false as const, error: "Ungültige Buchungsfarbe." };
  }
  // the logo is resized client-side to max 256px, so a few 100 KB is plenty
  if (logo && (logo.length > 400_000 || !LOGO.test(logo))) {
    return { success: false as const, error: "Logo muss ein PNG, JPG oder WebP unter 300 KB sein." };
  }
  const tenant = authCheck.tenant;
  const settings = { ...((tenant.settingsJson ?? {}) as TenantSettings) };
  if (brandColor) settings.brandColor = brandColor.toLowerCase();
  else delete settings.brandColor;
  if (bookingColors) {
    settings.bookingColors = Object.fromEntries(roleColors.map(([k, v]) => [k, v!.toLowerCase()]));
  }
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { settingsJson: settings as object, ...(logo !== undefined ? { logoUrl: logo } : {}) },
  });
  revalidatePath(`/c/${clubSlug}`, "layout");
  return { success: true as const };
}

export interface CourtInput {
  id?: string;
  name: string;
  sportType: SportType;
  surface: "CLAY" | "HARD" | "ARTIFICIAL_GRASS" | "CARPET";
  hourlyRate: number;
  isIndoor: boolean;
  hasLighting: boolean;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  sortOrder: number;
}

/** Create (no id) or update a court of this club. */
export async function saveCourtAction(clubSlug: string, c: CourtInput) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  if (!process.env.DATABASE_URL) return { success: false as const, error: "Plätze bearbeiten braucht eine Datenbank." };
  const tenant = authCheck.tenant;
  const name = String(c.name ?? "").trim().slice(0, 60);
  const rate = Number(c.hourlyRate);
  if (!name) return { success: false as const, error: "Bitte einen Namen angeben." };
  if (!["TENNIS", "PADEL"].includes(c.sportType)) return { success: false as const, error: "Ungültige Sportart." };
  if (!["CLAY", "HARD", "ARTIFICIAL_GRASS", "CARPET"].includes(c.surface)) return { success: false as const, error: "Ungültiger Belag." };
  if (!["ACTIVE", "MAINTENANCE", "INACTIVE"].includes(c.status)) return { success: false as const, error: "Ungültiger Status." };
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return { success: false as const, error: "Stundensatz zwischen 0 und 1000 CHF." };
  const data = {
    name,
    sportType: c.sportType,
    surface: c.surface,
    hourlyRate: rate,
    isIndoor: Boolean(c.isIndoor),
    hasLighting: Boolean(c.hasLighting),
    status: c.status,
    sortOrder: Math.max(0, Math.min(999, Math.round(Number(c.sortOrder) || 0))),
  };
  if (c.id) {
    const r = await prisma.court.updateMany({ where: { id: c.id, tenantId: tenant.id }, data });
    if (!r.count) return { success: false as const, error: "Platz nicht gefunden." };
  } else {
    const location =
      (await prisma.location.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: "asc" } })) ??
      (await prisma.location.create({ data: { tenantId: tenant.id, name: tenant.name, address: tenant.address ?? null } }));
    await prisma.court.create({ data: { ...data, tenantId: tenant.id, locationId: location.id } });
  }
  revalidatePath(`/c/${clubSlug}`, "layout");
  return { success: true as const };
}

/** Deletes a court without bookings; one with bookings is set inactive so history stays intact. */
export async function deleteCourtAction(clubSlug: string, courtId: string) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  if (!process.env.DATABASE_URL) return { success: false as const, error: "Plätze bearbeiten braucht eine Datenbank." };
  const tenant = authCheck.tenant;
  const court = await prisma.court.findFirst({ where: { id: courtId, tenantId: tenant.id }, select: { _count: { select: { bookings: true } } } });
  if (!court) return { success: false as const, error: "Platz nicht gefunden." };
  if (court._count.bookings) {
    await prisma.court.update({ where: { id: courtId }, data: { status: "INACTIVE" } });
    revalidatePath(`/c/${clubSlug}`, "layout");
    return { success: true as const, archived: true };
  }
  await prisma.court.delete({ where: { id: courtId } });
  revalidatePath(`/c/${clubSlug}`, "layout");
  return { success: true as const, archived: false };
}

export interface MemberInput {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** yyyy-mm-dd or "" */
  birthDate?: string;
  gender?: "M" | "F" | "X" | "";
  role: TenantRole;
  /** plan id to assign, "" = leave as is, "__end" = end the running Abo now */
  planId?: string;
  paid?: boolean;
  invite?: boolean;
}

/** Add a member by hand or edit one (for clubs without Fairgate & co.). */
export async function saveMemberAction(clubSlug: string, m: MemberInput) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  if (!process.env.DATABASE_URL) return { success: false as const, error: "Mitgliederverwaltung braucht eine Datenbank." };
  const tenant = authCheck.tenant;
  const selfId = authCheck.session?.user.id;

  const firstName = String(m.firstName ?? "").trim().slice(0, 60);
  const lastName = String(m.lastName ?? "").trim().slice(0, 60);
  const email = String(m.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(m.phone ?? "").trim().slice(0, 30) || null;
  const birthDate = m.birthDate ? parseDate(m.birthDate) : undefined;
  if (m.birthDate && !birthDate) return { success: false as const, error: "Ungültiges Geburtsdatum." };
  const gender = m.gender === "M" || m.gender === "F" || m.gender === "X" ? m.gender : null;
  if (!firstName) return { success: false as const, error: "Vorname fehlt." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false as const, error: "Ungültige E-Mail." };
  if (!ASSIGNABLE_ROLES.includes(m.role)) return { success: false as const, error: "Ungültige Rolle." };
  const profile = { firstName, lastName, phone, birthDate: birthDate ? new Date(birthDate) : null, gender };

  let userId = m.id;
  if (userId) {
    const tu = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId } },
      select: { role: true, user: { select: { email: true, _count: { select: { tenantUsers: true } } } } },
    });
    if (!tu || tu.role === "PLATFORM_ADMIN") return { success: false as const, error: "Mitglied nicht gefunden." };
    // a user in several clubs owns their identity; one club's admin must not rewrite it (e.g. the email)
    const own = tu.user._count.tenantUsers === 1;
    if (!own && email !== tu.user.email) {
      return { success: false as const, error: "Dieses Mitglied ist in mehreren Clubs. Die E-Mail ändert es selbst im Profil." };
    }
    if (email !== tu.user.email && (await prisma.user.findUnique({ where: { email } }))) {
      return { success: false as const, error: "Diese E-Mail gehört bereits einem anderen Konto." };
    }
    if (own) await prisma.user.update({ where: { id: userId }, data: { ...profile, email } });
    if (userId !== selfId && m.role !== tu.role) {
      await prisma.tenantUser.update({ where: { tenantId_userId: { tenantId: tenant.id, userId } }, data: { role: m.role } });
    }
  } else {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, birthDate: true, gender: true, phone: true } });
    if (existing && (await prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: existing.id } } }))) {
      return { success: false as const, error: "Diese Person ist bereits im Club." };
    }
    // an existing account keeps its name; only empty fields are filled
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            phone: existing.phone ?? phone,
            birthDate: existing.birthDate ?? profile.birthDate,
            gender: existing.gender ?? gender,
          },
        })
      : await prisma.user.create({ data: { ...profile, email, passwordHash: null } });
    userId = user.id;
    await prisma.tenantUser.create({ data: { tenantId: tenant.id, userId, role: m.role } });
    if (m.invite && !user.passwordHash) {
      await sendPasswordLink(email, user.firstName, tenant.name, passwordLink(tenant.slug, userId, null), "invite").catch(() => false);
    }
  }

  if (m.planId === "__end") {
    // paid Abos end as EXPIRED (their revenue stays in the stats), open invoices are cancelled
    await prisma.membership.updateMany({ where: { tenantId: tenant.id, userId, status: "ACTIVE" }, data: { status: "EXPIRED", endsAt: new Date() } });
    await prisma.membership.updateMany({ where: { tenantId: tenant.id, userId, status: "PENDING" }, data: { status: "CANCELLED", endsAt: new Date() } });
  } else if (m.planId) {
    const plan = await prisma.membershipPlan.findFirst({ where: { id: m.planId, tenantId: tenant.id }, select: { id: true } });
    if (!plan) return { success: false as const, error: "Abo nicht gefunden." };
    // "Wechseln zu": the new plan replaces the running one today
    if (m.paid) await grantMembership(tenant.id, userId, plan.id, undefined, undefined, true);
    else if (!(await prisma.membership.findFirst({ where: { tenantId: tenant.id, userId, membershipPlanId: plan.id, status: "PENDING" } }))) {
      await prisma.membership.create({
        data: { tenantId: tenant.id, userId, membershipPlanId: plan.id, status: "PENDING", startsAt: new Date(), endsAt: seasonEnd() },
      });
    }
  }

  revalidatePath(`/c/${clubSlug}/admin`, "layout");
  return { success: true as const };
}

/** Offline payment of an assigned Abo (cash, bank transfer): PENDING → ACTIVE. */
export async function markMembershipPaidAction(clubSlug: string, userId: string) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  const pending = await prisma.membership.findFirst({ where: { tenantId: authCheck.tenant.id, userId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (!pending) return { success: false as const, error: "Kein offenes Abo gefunden." };
  await grantMembership(authCheck.tenant.id, userId, pending.membershipPlanId);
  revalidatePath(`/c/${clubSlug}/admin`, "layout");
  return { success: true as const };
}

/** Next season of the current Abo: paid = ACTIVE right away, else an open invoice (PENDING) starting when the current one ends. */
export async function renewMembershipAction(clubSlug: string, userId: string, paid: boolean) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  const tenantId = authCheck.tenant.id;
  const current = await prisma.membership.findFirst({
    where: { tenantId, userId, status: "ACTIVE", endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
    include: { plan: true },
  });
  if (!current?.endsAt) return { success: false as const, error: "Kein laufendes Abo zum Verlängern." };
  if (isPartnerRow(current)) return { success: false as const, error: "Paar-Abo: bitte beim Käufer verlängern, nicht beim Partner." };
  const next = await prisma.membership.count({ where: { tenantId, userId, status: { in: ["ACTIVE", "PENDING"] }, startsAt: { gte: current.endsAt } } });
  if (next) return { success: false as const, error: "Ist bereits für die nächste Saison verlängert." };
  if (paid) await grantMembership(tenantId, userId, current.membershipPlanId);
  else {
    const startsAt = new Date(current.endsAt.getTime() + 1000);
    await prisma.membership.create({ data: { tenantId, userId, membershipPlanId: current.membershipPlanId, status: "PENDING", startsAt, endsAt: seasonEnd(startsAt) } });
  }
  revalidatePath(`/c/${clubSlug}/admin`, "layout");
  return { success: true as const };
}

/** Renewal mail to each given member with a running Abo; returns how many were sent. */
export async function sendRenewalRemindersAction(clubSlug: string, userIds: string[]) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  const tenant = authCheck.tenant;
  const running = await prisma.membership.findMany({
    where: { tenantId: tenant.id, userId: { in: userIds.slice(0, 500) }, status: "ACTIVE", endsAt: { gt: new Date() } },
    include: { user: true, plan: true },
    orderBy: { endsAt: "desc" },
    distinct: ["userId"],
  });
  let sent = 0;
  for (const m of running) {
    if (await sendRenewalReminder(m.user.email, m.user.firstName, m.plan.name, m.membershipPlanId, m.endsAt!, tenant.name, tenant.slug)) sent++;
  }
  return { success: true as const, sent, skipped: userIds.length - sent };
}

/** Removes the person from this club. Account, bookings and payments stay for the books. */
export async function removeMemberAction(clubSlug: string, userId: string) {
  const authCheck = await verifyClubAdmin(clubSlug);
  if (!authCheck.authorized || !authCheck.tenant) return { success: false as const, error: authCheck.error };
  if (userId === authCheck.session?.user.id) return { success: false as const, error: "Du kannst dich nicht selbst entfernen." };
  const tenantId = authCheck.tenant.id;
  const r = await prisma.tenantUser.deleteMany({ where: { tenantId, userId, role: { not: "PLATFORM_ADMIN" } } });
  if (!r.count) return { success: false as const, error: "Mitglied nicht gefunden." };
  await prisma.membership.updateMany({ where: { tenantId, userId, status: "PENDING" }, data: { status: "CANCELLED" } });
  revalidatePath(`/c/${clubSlug}/admin`, "layout");
  return { success: true as const };
}
