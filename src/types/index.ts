export type TenantRole =
  | "PLATFORM_ADMIN"
  | "CLUB_ADMIN"
  | "COURT_MANAGER"
  | "COACH"
  | "MEMBER"
  | "GUEST";

export type SportType = "TENNIS" | "PADEL";

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
  // Epic: credits, doubles, marly, equipment, multi-sport
  allowConsecutiveSlotsForDoubles?: boolean;
  marlyRuleEnabled?: boolean;
  marlyCooldownMinutes?: number;
  maxActiveSlotsPerPlayer?: number;
  ballMachineAvailable?: boolean;
  ballMachineFee?: number;
  floodlightFee?: number;
  guestFee?: number;
  defaultHourlyRateTennis?: number;
  defaultHourlyRateHalle?: number;
  defaultHourlyRatePadel?: number;
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
  sportType: SportType;
  surface: CourtSurface;
  hourlyRate: number;
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
  totalCost?: number;
  hasBallMachine?: boolean;
  hasLighting?: boolean;
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

export type WalletTransactionType =
  | "TOP_UP"
  | "BOOKING_PAYMENT"
  | "REFUND"
  | "ADMIN_GRANT";

export interface WalletTransaction {
  id: string;
  walletId: string;
  amount: number;
  type: WalletTransactionType;
  description: string;
  bookingId?: string | null;
  createdAt: string;
}

export interface UserWallet {
  id: string;
  tenantId: string;
  userId: string;
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
}
