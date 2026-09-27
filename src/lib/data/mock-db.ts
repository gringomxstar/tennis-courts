import {
  Tenant,
  Court,
  Booking,
  CourtBlock,
  UserSummary,
  MembershipPlan,
} from "@/types";

// Base Mock Store
class MockDatabase {
  tenants: Tenant[] = [
    {
      id: "tenant-rot-weiss",
      name: "TC Rot-Weiss Zürich",
      slug: "tc-rot-weiss",
      timezone: "Europe/Zurich",
      address: "Tennisweg 12, 8044 Zürich",
      email: "info@tc-rotweiss.ch",
      phone: "+41 44 251 00 00",
      status: "ACTIVE",
      settingsJson: {
        openingHour: 7,
        closingHour: 22,
        slotDurationMinutes: 60,
        cancellationDeadlineHours: 24,
        allowGuestBookings: true,
      },
    },
    {
      id: "tenant-obersee",
      name: "Tennis Club Obersee",
      slug: "tc-obersee",
      timezone: "Europe/Zurich",
      address: "Seestrasse 45, 8640 Rapperswil",
      email: "kontakt@tc-obersee.ch",
      phone: "+41 55 220 10 00",
      status: "ACTIVE",
      settingsJson: {
        openingHour: 8,
        closingHour: 22,
        slotDurationMinutes: 60,
        cancellationDeadlineHours: 12,
        allowGuestBookings: true,
      },
    },
  ];

  courts: Court[] = [
    {
      id: "court-1",
      tenantId: "tenant-rot-weiss",
      locationId: "loc-1",
      name: "Platz 1 (Center Court)",
      surface: "CLAY",
      isIndoor: false,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 1,
    },
    {
      id: "court-2",
      tenantId: "tenant-rot-weiss",
      locationId: "loc-1",
      name: "Platz 2",
      surface: "CLAY",
      isIndoor: false,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 2,
    },
    {
      id: "court-3",
      tenantId: "tenant-rot-weiss",
      locationId: "loc-1",
      name: "Platz 3",
      surface: "CLAY",
      isIndoor: false,
      hasLighting: false,
      status: "ACTIVE",
      sortOrder: 3,
    },
    {
      id: "court-4",
      tenantId: "tenant-rot-weiss",
      locationId: "loc-1",
      name: "Platz 4 (Allwetter)",
      surface: "HARD",
      isIndoor: false,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 4,
    },
    // TC Obersee courts
    {
      id: "court-ob-1",
      tenantId: "tenant-obersee",
      locationId: "loc-2",
      name: "Seeplatz 1",
      surface: "CLAY",
      isIndoor: false,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 1,
    },
    {
      id: "court-ob-2",
      tenantId: "tenant-obersee",
      locationId: "loc-2",
      name: "Halle 1",
      surface: "CARPET",
      isIndoor: true,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 2,
    },
  ];

  users: (UserSummary & { password?: string; tenantId: string })[] = [
    {
      id: "user-admin",
      email: "admin@tennisapp.ch",
      firstName: "Plattform",
      lastName: "Admin",
      phone: "+41 79 100 00 00",
      role: "PLATFORM_ADMIN",
      isPlatformAdmin: true,
      tenantId: "tenant-rot-weiss",
    },
    {
      id: "user-clubadmin",
      email: "clubadmin@tc-rotweiss.ch",
      firstName: "Marc",
      lastName: "Rosset",
      phone: "+41 79 200 00 00",
      role: "CLUB_ADMIN",
      tenantId: "tenant-rot-weiss",
    },
    {
      id: "user-roger",
      email: "roger@tc-rotweiss.ch",
      firstName: "Roger",
      lastName: "Federer",
      phone: "+41 79 300 00 01",
      role: "MEMBER",
      tenantId: "tenant-rot-weiss",
    },
    {
      id: "user-stan",
      email: "stan@tc-rotweiss.ch",
      firstName: "Stan",
      lastName: "Wawrinka",
      phone: "+41 79 300 00 02",
      role: "MEMBER",
      tenantId: "tenant-rot-weiss",
    },
    {
      id: "user-belinda",
      email: "belinda@tc-rotweiss.ch",
      firstName: "Belinda",
      lastName: "Bencic",
      phone: "+41 79 300 00 03",
      role: "MEMBER",
      tenantId: "tenant-rot-weiss",
    },
  ];

  membershipPlans: MembershipPlan[] = [
    {
      id: "plan-aktiv",
      tenantId: "tenant-rot-weiss",
      name: "Aktivmitglied",
      description: "Unbeschränktes Spielrecht während der gesamten Saison",
      price: 450,
      currency: "CHF",
      bookingWindowDays: 7,
      simultaneousBookingLimit: 4,
      dailyBookingLimit: 2,
      weeklyBookingLimit: 6,
      allowedDurations: [60, 90],
    },
    {
      id: "plan-junior",
      tenantId: "tenant-rot-weiss",
      name: "Junior",
      description: "Für Jugendliche bis 18 Jahre (werktags bis 17:00 Uhr)",
      price: 180,
      currency: "CHF",
      bookingWindowDays: 5,
      simultaneousBookingLimit: 2,
      dailyBookingLimit: 1,
      weeklyBookingLimit: 4,
      allowedDurations: [60],
    },
  ];

  bookings: Booking[] = [];
  courtBlocks: CourtBlock[] = [];

  constructor() {
    this.seedDynamicData();
  }

  private seedDynamicData() {
    // Generate bookings for today & tomorrow dynamically
    const now = new Date();
    
    // Helper to format ISO with specific hour/minute
    const makeDate = (dayOffset: number, hour: number, minute: number = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    };

    // Today 10:00 - 11:00 on Court 1 (Roger & Stan)
    this.bookings.push({
      id: "booking-demo-1",
      tenantId: "tenant-rot-weiss",
      courtId: "court-1",
      organizerId: "user-roger",
      startsAt: makeDate(0, 10, 0),
      endsAt: makeDate(0, 11, 0),
      status: "CONFIRMED",
      bookingType: "MEMBER",
      notes: "Einzel Match Training",
      organizer: {
        id: "user-roger",
        firstName: "Roger",
        lastName: "Federer",
        email: "roger@tc-rotweiss.ch",
      },
      participants: [
        {
          id: "part-1",
          bookingId: "booking-demo-1",
          userId: "user-roger",
          role: "ORGANIZER",
          invitationStatus: "ACCEPTED",
          user: {
            id: "user-roger",
            firstName: "Roger",
            lastName: "Federer",
            email: "roger@tc-rotweiss.ch",
          },
        },
        {
          id: "part-2",
          bookingId: "booking-demo-1",
          userId: "user-stan",
          role: "PLAYER",
          invitationStatus: "ACCEPTED",
          user: {
            id: "user-stan",
            firstName: "Stan",
            lastName: "Wawrinka",
            email: "stan@tc-rotweiss.ch",
          },
        },
      ],
    });

    // Today 14:00 - 15:00 on Court 2 (Belinda & Gast)
    this.bookings.push({
      id: "booking-demo-2",
      tenantId: "tenant-rot-weiss",
      courtId: "court-2",
      organizerId: "user-belinda",
      startsAt: makeDate(0, 14, 0),
      endsAt: makeDate(0, 15, 0),
      status: "CONFIRMED",
      bookingType: "MEMBER",
      notes: "Sparring mit Gast",
      organizer: {
        id: "user-belinda",
        firstName: "Belinda",
        lastName: "Bencic",
        email: "belinda@tc-rotweiss.ch",
      },
      participants: [
        {
          id: "part-3",
          bookingId: "booking-demo-2",
          userId: "user-belinda",
          role: "ORGANIZER",
          invitationStatus: "ACCEPTED",
          user: {
            id: "user-belinda",
            firstName: "Belinda",
            lastName: "Bencic",
            email: "belinda@tc-rotweiss.ch",
          },
        },
        {
          id: "part-4",
          bookingId: "booking-demo-2",
          guestName: "Martina Hingis",
          role: "GUEST",
          invitationStatus: "ACCEPTED",
        },
      ],
    });

    // Today 12:00 - 13:00 on Court 3 (Block: Platzpflege)
    this.courtBlocks.push({
      id: "block-demo-1",
      tenantId: "tenant-rot-weiss",
      courtId: "court-3",
      startsAt: makeDate(0, 12, 0),
      endsAt: makeDate(0, 13, 0),
      reason: "MAINTENANCE",
      description: "Platzpflege & Walzen",
      createdById: "user-clubadmin",
    });

    // Tomorrow 18:00 - 19:30 on Court 1 (Marc Rosset & Roger)
    this.bookings.push({
      id: "booking-demo-3",
      tenantId: "tenant-rot-weiss",
      courtId: "court-1",
      organizerId: "user-clubadmin",
      startsAt: makeDate(1, 18, 0),
      endsAt: makeDate(1, 19, 30),
      status: "CONFIRMED",
      bookingType: "MEMBER",
      notes: "Clubmeisterschaft Vorbereitung",
      organizer: {
        id: "user-clubadmin",
        firstName: "Marc",
        lastName: "Rosset",
        email: "clubadmin@tc-rotweiss.ch",
      },
      participants: [
        {
          id: "part-5",
          bookingId: "booking-demo-3",
          userId: "user-clubadmin",
          role: "ORGANIZER",
          invitationStatus: "ACCEPTED",
          user: {
            id: "user-clubadmin",
            firstName: "Marc",
            lastName: "Rosset",
            email: "clubadmin@tc-rotweiss.ch",
          },
        },
      ],
    });
  }

  // Query helpers
  getTenantBySlug(slug: string): Tenant | undefined {
    return this.tenants.find((t) => t.slug === slug);
  }

  getCourtsByTenantId(tenantId: string): Court[] {
    return this.courts
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getUsersByTenantId(tenantId: string): UserSummary[] {
    return this.users.filter((u) => u.tenantId === tenantId);
  }

  getUserByEmail(email: string): (UserSummary & { tenantId: string }) | undefined {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserById(id: string): UserSummary | undefined {
    return this.users.find((u) => u.id === id);
  }

  getBookings(tenantId: string, dateString: string): Booking[] {
    // dateString format YYYY-MM-DD
    return this.bookings.filter((b) => {
      if (b.tenantId !== tenantId || b.status === "CANCELLED") return false;
      const bDate = b.startsAt.split("T")[0];
      return bDate === dateString;
    });
  }

  getCourtBlocks(tenantId: string, dateString: string): CourtBlock[] {
    return this.courtBlocks.filter((cb) => {
      if (cb.tenantId !== tenantId) return false;
      const cbDate = cb.startsAt.split("T")[0];
      return cbDate === dateString;
    });
  }

  getAllUserBookings(userId: string): Booking[] {
    return this.bookings.filter(
      (b) =>
        (b.organizerId === userId ||
          b.participants.some((p) => p.userId === userId)) &&
        b.status !== "CANCELLED"
    );
  }

  // Mutation helpers
  createBooking(booking: Omit<Booking, "id">): Booking {
    const id = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newBooking: Booking = { ...booking, id };
    this.bookings.push(newBooking);
    return newBooking;
  }

  cancelBooking(bookingId: string, _cancelledById?: string): boolean {
    const b = this.bookings.find((item) => item.id === bookingId);
    if (!b) return false;
    b.status = "CANCELLED";
    return Boolean(_cancelledById || true);
  }

  createCourtBlock(block: Omit<CourtBlock, "id">): CourtBlock {
    const id = `block-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newBlock: CourtBlock = { ...block, id };
    this.courtBlocks.push(newBlock);
    return newBlock;
  }

  registerUser(user: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    tenantSlug: string;
  }): UserSummary {
    const tenant = this.getTenantBySlug(user.tenantSlug) || this.tenants[0];
    const newUser: UserSummary & { tenantId: string } = {
      id: `user-${Date.now()}`,
      email: user.email.toLowerCase(),
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || null,
      role: "MEMBER",
      tenantId: tenant.id,
    };
    this.users.push(newUser);
    return newUser;
  }
}

// Global singleton instance
const globalForMock = globalThis as unknown as {
  mockDb: MockDatabase | undefined;
};

export const mockDb = globalForMock.mockDb ?? new MockDatabase();
if (process.env.NODE_ENV !== "production") globalForMock.mockDb = mockDb;
