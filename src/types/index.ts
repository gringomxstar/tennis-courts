export type TenantRole =
  | "PLATFORM_ADMIN"
  | "CLUB_ADMIN"
  | "COURT_MANAGER"
  | "COACH"
  | "MEMBER"
  | "GUEST";

export type CourtSurface = "CLAY" | "HARD" | "ARTIFICIAL_GRASS" | "CARPET";
export type CourtStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED"
  | "COMPLETED"
  | "NO_SHOW";

export type BookingType =
  | "MEMBER"
  | "GUEST"
  | "COACH"
  | "COURSE"
  | "TOURNAMENT"
  | "ADMIN"
  | "MAINTENANCE"
  | "EVENT";

export type BlockReason =
  | "MAINTENANCE"
  | "RAIN"
  | "SNOW"
  | "TOURNAMENT"
  | "TRAINING"
  | "EVENT"
  | "PRIVATE"
  | "OTHER";

export interface TenantSettings {
  openingHour: number;
  closingHour: number;
  slotDurationMinutes: number;
  cancellationDeadlineHours: number;
  allowGuestBookings?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  timezone: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  settingsJson?: TenantSettings | null;
}

export interface Court {
  id: string;
  tenantId: string;
  locationId: string;
  name: string;
  surface: CourtSurface;
  isIndoor: boolean;
  hasLighting: boolean;
  status: CourtStatus;
  sortOrder: number;
}

export type ParticipantRole = "ORGANIZER" | "PLAYER" | "GUEST" | "COACH";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface BookingParticipant {
  id: string;
  bookingId: string;
  userId?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  role: ParticipantRole;
  invitationStatus: InvitationStatus;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface Booking {
  id: string;
  tenantId: string;
  courtId: string;
  organizerId: string;
  startsAt: string; // ISO string for client serialization
  endsAt: string;
  status: BookingStatus;
  bookingType: BookingType;
  price?: number;
  currency?: string;
  notes?: string | null;
  organizer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  court?: Court;
  participants: BookingParticipant[];
}

export interface CourtBlock {
  id: string;
  tenantId: string;
  courtId: string;
  startsAt: string; // ISO string
  endsAt: string;
  reason: BlockReason;
  description?: string | null;
  createdById: string;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: TenantRole;
  isPlatformAdmin?: boolean;
}

export interface MembershipPlan {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  bookingWindowDays: number;
  simultaneousBookingLimit: number;
  dailyBookingLimit: number;
  weeklyBookingLimit: number;
  allowedDurations: number[];
}
