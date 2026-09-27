"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  getTenantBySlug,
  updateTenantSettings,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
} from "@/lib/data";
import { TenantSettings } from "@/types";

async function verifyClubAdmin(clubSlug: string) {
  const session = await auth();
  if (!session?.user) {
    return { authorized: false, error: "Bitte melde dich an." };
  }

  const isPlatformAdmin = Boolean(
    session.user.isPlatformAdmin || session.user.role === "PLATFORM_ADMIN"
  );
  const isClubAdmin =
    isPlatformAdmin ||
    session.user.role === "CLUB_ADMIN" ||
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

  const updated = await updateTenantSettings(clubSlug, {
    openingHour: opening,
    closingHour: closing,
    slotDurationMinutes: slotDuration,
    cancellationDeadlineHours: cancellationDeadline,
    allowGuestBookings: Boolean(settings.allowGuestBookings),
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

  const deleted = await deleteMembershipPlan(planId);
  if (!deleted) {
    return { success: false, error: "Tarif konnte nicht gelöscht werden." };
  }

  revalidatePath(`/c/${clubSlug}/admin`);
  return { success: true };
}
