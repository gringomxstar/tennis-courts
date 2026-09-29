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
  /** Storno deadline in minutes before the start; wins over cancellationDeadlineHours. */
  cancellationDeadlineMinutes?: number;
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
  /** Active-slot limit per role and sport; null = unlimited. A missing role falls back to maxActiveSlotsPerPlayer (Marly). */
  slotLimits?: Partial<Record<LimitRole, Partial<Record<SportType, number | null>>>>;
  /** Minutes after a slot's start during which it can still be booked. */
  lateBookingMinutes?: number;
  payOnSite?: boolean;
  payByInvoice?: boolean;
  /** Bank details printed on Abo invoices; without an IBAN "Auf Rechnung" is not offered. */
  invoiceIban?: string;
  invoiceBank?: string;
  priceRules?: PriceRule[];
  /** Diner Tennis: in this window a member with Abo brings 1 guest free (they lunch together at the club). */
  dinerTennis?: { enabled: boolean; weekdays: number[]; fromHour: number; toHour: number };
  /** Role switcher with the fixed demo personas (src/lib/demo.ts); off = demo logins refused. */
  demoMode?: boolean;
  /** Club accent color (#rrggbb), replaces the default clay orange. */
  brandColor?: string;
  /** Calendar box color (#rrggbb) of other people's bookings per booking role; defaults in BOOKING_COLORS. */
  bookingColors?: Partial<Record<LimitRole, string>>;
}

export type LimitRole = "MEMBER" | "COACH" | "GUEST";

/** Court price adjustment. All set conditions must match; percent is added to the court price (-20 = 20% off). */
export interface PriceRule {
  label: string;
  percent: number;
  weekdays?: number[]; // 0 = Sunday
  fromHour?: number;
  toHour?: number; // exclusive
  minLeadHours?: number; // early bird: booked at least this long before start
  maxLeadHours?: number; // last minute: booked at most this long before start
}

export type PaymentMethod = "WALLET" | "ONLINE" | "ON_SITE" | "INVOICE";

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
  /** Trainer weekly series this booking belongs to. */
  seriesId?: string;
  paymentStatus?: "UNPAID" | "PAID" | "WAIVED";
  paymentMethod?: PaymentMethod;
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
  /** Max. guests the member may bring per calendar week; null/undefined = unlimited. */
  guestsPerWeek?: number | null;
  /** Sports the plan waives the court fee for (stored in rulesJson; default Tennis). */
  sports?: SportType[];
  /** Grouping on the Abo page, e.g. "Erwachsene", "Junioren". */
  category?: string | null;
  /** 2 = Paar-Abo: the buyer names a second person who gets the same membership. */
  persons?: 1 | 2;
  ageMin?: number | null;
  ageMax?: number | null;
  /** e.g. student card; the club checks it, the app only shows the hint. */
  proofRequired?: boolean;
  /** Only bookable inside this window (Abo Soleil: Mo–Fr 8–16). Weekdays 0 = Sunday. */
  playWindow?: { weekdays: number[]; fromHour: number; toHour: number } | null;
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
