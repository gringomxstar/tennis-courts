import {
  Tenant,
  TenantSettings,
  Court,
  Booking,
  CourtBlock,
  UserSummary,
  MembershipPlan,
  UserWallet,
  WalletTransaction,
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
        allowConsecutiveSlotsForDoubles: true,
        marlyRuleEnabled: true,
        marlyCooldownMinutes: 60,
        maxActiveSlotsPerPlayer: 2,
        ballMachineAvailable: true,
        ballMachineFee: 10,
        floodlightFee: 5,
        guestFee: 15,
        defaultHourlyRateTennis: 30,
        defaultHourlyRateHalle: 45,
        defaultHourlyRatePadel: 40,
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
        allowConsecutiveSlotsForDoubles: true,
        marlyRuleEnabled: true,
        marlyCooldownMinutes: 60,
        maxActiveSlotsPerPlayer: 2,
        ballMachineAvailable: true,
        ballMachineFee: 10,
        floodlightFee: 5,
        guestFee: 15,
        defaultHourlyRateTennis: 30,
        defaultHourlyRateHalle: 45,
        defaultHourlyRatePadel: 40,
      },
    },
  ];

  courts: Court[] = [
    {
      id: "court-1",
      tenantId: "tenant-rot-weiss",
      locationId: "loc-1",
      name: "Platz 1 (Center Court)",
      sportType: "TENNIS",
      surface: "CLAY",
      hourlyRate: 30,
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
      sportType: "TENNIS",
      surface: "CLAY",
      hourlyRate: 30,
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
      sportType: "TENNIS",
      surface: "CLAY",
      hourlyRate: 30,
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
      sportType: "TENNIS",
      surface: "HARD",
      hourlyRate: 30,
      isIndoor: false,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 4,
    },
    {
      id: "court-5",
      tenantId: "tenant-rot-weiss",
      locationId: "loc-1",
      name: "Padel Court 1",
      sportType: "PADEL",
      surface: "ARTIFICIAL_GRASS",
      hourlyRate: 40,
      isIndoor: false,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 5,
    },
    {
      id: "court-6",
      tenantId: "tenant-rot-weiss",
      locationId: "loc-1",
      name: "Halle 1 (Teppich)",
      sportType: "TENNIS",
      surface: "CARPET",
      hourlyRate: 45,
      isIndoor: true,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 6,
    },
    // TC Obersee courts
    {
      id: "court-ob-1",
      tenantId: "tenant-obersee",
      locationId: "loc-2",
      name: "Seeplatz 1",
      sportType: "TENNIS",
      surface: "CLAY",
      hourlyRate: 30,
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
      sportType: "TENNIS",
      surface: "CARPET",
      hourlyRate: 45,
      isIndoor: true,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 2,
    },
    {
      id: "court-ob-3",
      tenantId: "tenant-obersee",
      locationId: "loc-2",
      name: "Padel Panorama",
      sportType: "PADEL",
      surface: "ARTIFICIAL_GRASS",
      hourlyRate: 40,
      isIndoor: false,
      hasLighting: true,
      status: "ACTIVE",
      sortOrder: 3,
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
      allowedDurations: [60, 90, 120],
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
  wallets: UserWallet[] = [];

  constructor() {
    this.seedDynamicData();
  }

  private seedDynamicData() {
    // Generate bookings for today & tomorrow dynamically
    const now = new Date();

    // Init wallets
    this.wallets = [
      {
        id: "wallet-admin",
        tenantId: "tenant-rot-weiss",
        userId: "user-admin",
        balance: 200,
        currency: "CHF",
        transactions: [
          {
            id: "tx-init-admin",
            walletId: "wallet-admin",
            amount: 200,
            type: "TOP_UP",
            description: "Startguthaben Dev/Test",
            createdAt: now.toISOString(),
          },
        ],
      },
      {
        id: "wallet-clubadmin",
        tenantId: "tenant-rot-weiss",
        userId: "user-clubadmin",
        balance: 150,
        currency: "CHF",
        transactions: [
          {
            id: "tx-init-clubadmin",
            walletId: "wallet-clubadmin",
            amount: 150,
            type: "TOP_UP",
            description: "Startguthaben Club Admin",
            createdAt: now.toISOString(),
          },
        ],
      },
      {
        id: "wallet-roger",
        tenantId: "tenant-rot-weiss",
        userId: "user-roger",
        balance: 100,
        currency: "CHF",
        transactions: [
          {
            id: "tx-init-roger",
            walletId: "wallet-roger",
            amount: 100,
            type: "TOP_UP",
            description: "Startguthaben Roger Federer",
            createdAt: now.toISOString(),
          },
        ],
      },
      {
        id: "wallet-stan",
        tenantId: "tenant-rot-weiss",
        userId: "user-stan",
        balance: 75,
        currency: "CHF",
        transactions: [
          {
            id: "tx-init-stan",
            walletId: "wallet-stan",
            amount: 75,
            type: "TOP_UP",
            description: "Startguthaben Stan Wawrinka",
            createdAt: now.toISOString(),
          },
        ],
      },
      {
        id: "wallet-belinda",
        tenantId: "tenant-rot-weiss",
        userId: "user-belinda",
        balance: 50,
        currency: "CHF",
        transactions: [
          {
            id: "tx-init-belinda",
            walletId: "wallet-belinda",
            amount: 50,
            type: "TOP_UP",
            description: "Startguthaben Belinda Bencic",
            createdAt: now.toISOString(),
          },
        ],
      },
    ];
    
    // Helper to format ISO with specific hour/minute
    const makeDate = (dayOffset: number, hour: number, minute: number = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    };

    // Today 10:00 - 11:00 on Court 1 (Roger & Stan, with Ball Machine!)
    this.bookings.push({
      id: "booking-demo-1",
      tenantId: "tenant-rot-weiss",
      courtId: "court-1",
      organizerId: "user-roger",
      startsAt: makeDate(0, 10, 0),
      endsAt: makeDate(0, 11, 0),
      status: "CONFIRMED",
      bookingType: "MEMBER",
      hasBallMachine: true,
      hasLighting: false,
      totalCost: 10,
      notes: "Einzel Match Training mit Ballmaschine",
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

    // Today 14:00 - 15:00 on Court 2 (Belinda & Gast Martina Hingis)
    this.bookings.push({
      id: "booking-demo-2",
      tenantId: "tenant-rot-weiss",
      courtId: "court-2",
      organizerId: "user-belinda",
      startsAt: makeDate(0, 14, 0),
      endsAt: makeDate(0, 15, 0),
      status: "CONFIRMED",
      bookingType: "MEMBER",
      hasBallMachine: false,
      hasLighting: false,
      totalCost: 15,
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
          guestEmail: "martina@hingis-tennis.ch",
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
      hasBallMachine: false,
      hasLighting: true,
      totalCost: 5,
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
        {
          id: "part-6",
          bookingId: "booking-demo-3",
          userId: "user-roger",
          role: "PLAYER",
          invitationStatus: "ACCEPTED",
          user: {
            id: "user-roger",
            firstName: "Roger",
            lastName: "Federer",
            email: "roger@tc-rotweiss.ch",
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

  // Wallet methods
  getWallet(tenantId: string, userId: string): UserWallet {
    let wallet = this.wallets.find((w) => w.tenantId === tenantId && w.userId === userId);
    if (!wallet) {
      wallet = {
        id: `wallet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tenantId,
        userId,
        balance: 50, // default starting credit for test ease
        currency: "CHF",
        transactions: [
          {
            id: `tx-${Date.now()}`,
            walletId: "",
            amount: 50,
            type: "TOP_UP",
            description: "Willkommensguthaben (50 CHF)",
            createdAt: new Date().toISOString(),
          },
        ],
      };
      wallet.transactions[0].walletId = wallet.id;
      this.wallets.push(wallet);
    }
    return wallet;
  }

  topUpWallet(tenantId: string, userId: string, amount: number, description?: string): UserWallet {
    const wallet = this.getWallet(tenantId, userId);
    wallet.balance += amount;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      walletId: wallet.id,
      amount,
      type: "TOP_UP",
      description: description || `Guthaben aufgeladen (+${amount} CHF)`,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(tx);
    return wallet;
  }

  deductWallet(
    tenantId: string,
    userId: string,
    amount: number,
    description: string,
    bookingId?: string
  ): { success: boolean; wallet?: UserWallet; error?: string } {
    const wallet = this.getWallet(tenantId, userId);
    if (wallet.balance < amount) {
      return {
        success: false,
        error: `Nicht genügend Guthaben. Benötigt: ${amount} CHF, Aktuell: ${wallet.balance} CHF.`,
      };
    }
    wallet.balance -= amount;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      walletId: wallet.id,
      amount: -amount,
      type: "BOOKING_PAYMENT",
      description,
      bookingId,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(tx);
    return { success: true, wallet };
  }

  refundWallet(
    tenantId: string,
    userId: string,
    amount: number,
    description: string,
    bookingId?: string
  ): UserWallet {
    const wallet = this.getWallet(tenantId, userId);
    wallet.balance += amount;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      walletId: wallet.id,
      amount,
      type: "REFUND",
      description,
      bookingId,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(tx);
    return wallet;
  }

  grantAdminCredits(
    tenantId: string,
    userId: string,
    amount: number,
    reason: string
  ): UserWallet {
    const wallet = this.getWallet(tenantId, userId);
    wallet.balance += amount;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      walletId: wallet.id,
      amount,
      type: "ADMIN_GRANT",
      description: `Admin-Gutschrift: ${reason} (+${amount} CHF)`,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(tx);
    return wallet;
  }

  // Ball Machine Exclusive Availability Check
  isBallMachineAvailable(
    tenantId: string,
    startsAt: string,
    endsAt: string,
    excludeBookingId?: string
  ): { available: boolean; conflictCourtName?: string } {
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();

    const conflict = this.bookings.find((b) => {
      if (b.tenantId !== tenantId || b.status === "CANCELLED" || !b.hasBallMachine) {
        return false;
      }
      if (excludeBookingId && b.id === excludeBookingId) return false;
      const bStart = new Date(b.startsAt).getTime();
      const bEnd = new Date(b.endsAt).getTime();
      return start < bEnd && end > bStart;
    });

    if (conflict) {
      const court = this.courts.find((c) => c.id === conflict.courtId);
      return {
        available: false,
        conflictCourtName: court?.name || "einem anderen Platz",
      };
    }
    return { available: true };
  }

  // Marly Rule & Cooldown Check
  checkMarlyRule(
    tenantId: string,
    userId: string,
    startsAt: string,
    endsAt: string,
    isDouble: boolean
  ): { allowed: boolean; reason?: string } {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    const settings = tenant?.settingsJson;
    if (!settings?.marlyRuleEnabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const targetStart = new Date(startsAt).getTime();
    const targetEnd = new Date(endsAt).getTime();

    // 1. Check max active slots limit (Rolling Release after expiration)
    const maxActive = settings.maxActiveSlotsPerPlayer ?? 2;
    const activeFutureBookings = this.bookings.filter((b) => {
      if (b.tenantId !== tenantId || b.status === "CANCELLED") return false;
      const isUserInvolved =
        b.organizerId === userId || b.participants.some((p) => p.userId === userId);
      if (!isUserInvolved) return false;
      // Active if its end time is still in future
      return new Date(b.endsAt).getTime() > now;
    });

    if (activeFutureBookings.length >= maxActive) {
      return {
        allowed: false,
        reason: `Buchungskontingent erschöpft: Maximal ${maxActive} aktive Reservierungen gleichzeitig möglich. Ein neuer Slot wird erst freigeschaltet, nachdem dein nächstes Spiel beendet ist (Rolling Release).`,
      };
    }

    // 2. Anti-Blockier-Regel (Kein Consecutive Booking im Einzel)
    if (!isDouble) {
      const hasConsecutive = activeFutureBookings.some((b) => {
        const bStart = new Date(b.startsAt).getTime();
        const bEnd = new Date(b.endsAt).getTime();
        // Starts exactly when previous ended, or ends exactly when next starts
        return bEnd === targetStart || bStart === targetEnd;
      });

      if (hasConsecutive) {
        return {
          allowed: false,
          reason:
            "Direkt aufeinanderfolgende Buchungen (2 Stunden am Stück) sind im Einzel nicht gestattet. Eine 2-stündige Reservierung ist exklusiv für 4er-Doppel reserviert.",
        };
      }
    }

    // 3. Cooldown / Mindestabstand between games
    const cooldownMs = (settings.marlyCooldownMinutes ?? 60) * 60 * 1000;
    if (cooldownMs > 0 && !isDouble) {
      const hasCooldownViolation = activeFutureBookings.some((b) => {
        const bStart = new Date(b.startsAt).getTime();
        const bEnd = new Date(b.endsAt).getTime();
        // Target starts too soon after b ended
        if (targetStart >= bEnd && targetStart - bEnd < cooldownMs) return true;
        // b starts too soon after target ended
        if (bStart >= targetEnd && bStart - targetEnd < cooldownMs) return true;
        return false;
      });

      if (hasCooldownViolation) {
        return {
          allowed: false,
          reason: `Fairplay-Regel: Zwischen deinen Spielen ist eine Pause von mindestens ${settings.marlyCooldownMinutes} Minuten vorgeschrieben.`,
        };
      }
    }

    return { allowed: true };
  }

  // Tenant settings & plans mutation helpers
  updateTenantSettings(slug: string, settings: Partial<TenantSettings>): Tenant | null {
    const tenant = this.getTenantBySlug(slug);
    if (!tenant) return null;
    tenant.settingsJson = {
      ...(tenant.settingsJson || {
        openingHour: 7,
        closingHour: 22,
        slotDurationMinutes: 60,
        cancellationDeadlineHours: 24,
      }),
      ...settings,
    };
    return tenant;
  }

  getMembershipPlans(tenantId: string): MembershipPlan[] {
    return this.membershipPlans.filter((p) => p.tenantId === tenantId);
  }

  createMembershipPlan(plan: Omit<MembershipPlan, "id">): MembershipPlan {
    const id = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newPlan: MembershipPlan = { ...plan, id };
    this.membershipPlans.push(newPlan);
    return newPlan;
  }

  updateMembershipPlan(id: string, plan: Partial<MembershipPlan>): MembershipPlan | null {
    const existing = this.membershipPlans.find((p) => p.id === id);
    if (!existing) return null;
    Object.assign(existing, plan);
    return existing;
  }

  deleteMembershipPlan(id: string): boolean {
    const initialLen = this.membershipPlans.length;
    this.membershipPlans = this.membershipPlans.filter((p) => p.id !== id);
    return this.membershipPlans.length < initialLen;
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
    // initialize wallet with 50 CHF welcome credit
    this.getWallet(tenant.id, newUser.id);
    return newUser;
  }
}

// Global singleton instance
const globalForMock = globalThis as unknown as {
  mockDb: MockDatabase | undefined;
};

function getInitializedMockDb(): MockDatabase {
  if (!globalForMock.mockDb) {
    return new MockDatabase();
  }
  // If singleton exists from before hot reload, re-link prototype
  Object.setPrototypeOf(globalForMock.mockDb, MockDatabase.prototype);

  // Ensure newly added fields exist on the cached instance
  if (!Array.isArray(globalForMock.mockDb.wallets)) {
    const fresh = new MockDatabase();
    globalForMock.mockDb.wallets = fresh.wallets;
  }

  // Re-verify that getWallet is a function, otherwise re-instantiate
  if (typeof globalForMock.mockDb.getWallet !== "function") {
    const fresh = new MockDatabase();
    fresh.bookings = globalForMock.mockDb.bookings || fresh.bookings;
    fresh.users = globalForMock.mockDb.users || fresh.users;
    fresh.courtBlocks = globalForMock.mockDb.courtBlocks || fresh.courtBlocks;
    globalForMock.mockDb = fresh;
  }

  return globalForMock.mockDb;
}

export const mockDb = getInitializedMockDb();
if (process.env.NODE_ENV !== "production") globalForMock.mockDb = mockDb;
