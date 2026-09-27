import { PrismaClient, TenantRole, UserStatus, CourtSurface, CourtStatus, BookingStatus, BookingType, ParticipantRole, InvitationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starte Seeding...");

  // 1. Passwörter hashen
  const passwordHash = await bcrypt.hash("tennis12345", 10);
  const adminPasswordHash = await bcrypt.hash("admin12345", 10);

  // 2. Platform Admin anlegen
  const platformAdmin = await prisma.user.upsert({
    where: { email: "admin@tennisapp.ch" },
    update: {},
    create: {
      email: "admin@tennisapp.ch",
      passwordHash: adminPasswordHash,
      firstName: "Plattform",
      lastName: "Admin",
      phone: "+41 79 100 00 00",
      status: UserStatus.ACTIVE,
      locale: "de",
      timezone: "Europe/Zurich",
    },
  });

  // 3. Demo Tenant anlegen
  const tenant = await prisma.tenant.upsert({
    where: { slug: "tc-rot-weiss" },
    update: {},
    create: {
      name: "TC Rot-Weiss Zürich",
      slug: "tc-rot-weiss",
      timezone: "Europe/Zurich",
      address: "Tennisweg 12, 8044 Zürich",
      email: "info@tc-rotweiss.ch",
      phone: "+41 44 251 00 00",
      settingsJson: {
        openingHour: 7,
        closingHour: 22,
        slotDurationMinutes: 60,
        cancellationDeadlineHours: 24,
      },
    },
  });

  // 4. Club-Admin anlegen
  const clubAdmin = await prisma.user.upsert({
    where: { email: "clubadmin@tc-rotweiss.ch" },
    update: {},
    create: {
      email: "clubadmin@tc-rotweiss.ch",
      passwordHash,
      firstName: "Marc",
      lastName: "Rosset",
      phone: "+41 79 200 00 00",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.tenantUser.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: clubAdmin.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: clubAdmin.id,
      role: TenantRole.CLUB_ADMIN,
    },
  });

  // 5. Mitglieder anlegen
  const roger = await prisma.user.upsert({
    where: { email: "roger@tc-rotweiss.ch" },
    update: {},
    create: {
      email: "roger@tc-rotweiss.ch",
      passwordHash,
      firstName: "Roger",
      lastName: "Federer",
      phone: "+41 79 300 00 01",
      status: UserStatus.ACTIVE,
    },
  });

  const stan = await prisma.user.upsert({
    where: { email: "stan@tc-rotweiss.ch" },
    update: {},
    create: {
      email: "stan@tc-rotweiss.ch",
      passwordHash,
      firstName: "Stan",
      lastName: "Wawrinka",
      phone: "+41 79 300 00 02",
      status: UserStatus.ACTIVE,
    },
  });

  const belinda = await prisma.user.upsert({
    where: { email: "belinda@tc-rotweiss.ch" },
    update: {},
    create: {
      email: "belinda@tc-rotweiss.ch",
      passwordHash,
      firstName: "Belinda",
      lastName: "Bencic",
      phone: "+41 79 300 00 03",
      status: UserStatus.ACTIVE,
    },
  });

  for (const user of [roger, stan, belinda]) {
    await prisma.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: user.id,
        role: TenantRole.MEMBER,
      },
    });
  }

  // 6. Standort anlegen
  const location = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      name: "Hauptanlage Fluntern",
      address: "Tennisweg 12, 8044 Zürich",
      latitude: 47.3782,
      longitude: 8.5638,
    },
  });

  // 7. Plätze anlegen
  const court1 = await prisma.court.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      name: "Platz 1 (Center Court)",
      surface: CourtSurface.CLAY,
      isIndoor: false,
      hasLighting: true,
      status: CourtStatus.ACTIVE,
      sortOrder: 1,
    },
  });

  await prisma.court.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      name: "Platz 2",
      surface: CourtSurface.CLAY,
      isIndoor: false,
      hasLighting: true,
      status: CourtStatus.ACTIVE,
      sortOrder: 2,
    },
  });

  await prisma.court.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      name: "Platz 3",
      surface: CourtSurface.CLAY,
      isIndoor: false,
      hasLighting: false,
      status: CourtStatus.ACTIVE,
      sortOrder: 3,
    },
  });

  await prisma.court.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      name: "Platz 4 (Allwetter)",
      surface: CourtSurface.HARD,
      isIndoor: false,
      hasLighting: true,
      status: CourtStatus.ACTIVE,
      sortOrder: 4,
    },
  });

  // 8. Mitgliedschaftstarife anlegen
  const planAktiv = await prisma.membershipPlan.create({
    data: {
      tenantId: tenant.id,
      name: "Aktivmitglied",
      description: "Unbeschränktes Spielrecht während der gesamten Saison",
      price: 450.0,
      currency: "CHF",
      bookingWindowDays: 7,
      simultaneousBookingLimit: 4,
      dailyBookingLimit: 2,
      weeklyBookingLimit: 6,
      allowedDurations: [60, 90],
    },
  });

  await prisma.membershipPlan.create({
    data: {
      tenantId: tenant.id,
      name: "Junior",
      description: "Für Jugendliche bis 18 Jahre (werktags bis 17:00 Uhr)",
      price: 180.0,
      currency: "CHF",
      bookingWindowDays: 5,
      simultaneousBookingLimit: 2,
      dailyBookingLimit: 1,
      weeklyBookingLimit: 4,
      allowedDurations: [60],
    },
  });

  // 9. Mitgliedschaften zuweisen
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  await prisma.membership.create({
    data: {
      tenantId: tenant.id,
      userId: roger.id,
      membershipPlanId: planAktiv.id,
      startsAt: new Date(),
      endsAt: oneYearFromNow,
    },
  });

  await prisma.membership.create({
    data: {
      tenantId: tenant.id,
      userId: stan.id,
      membershipPlanId: planAktiv.id,
      startsAt: new Date(),
      endsAt: oneYearFromNow,
    },
  });

  await prisma.membership.create({
    data: {
      tenantId: tenant.id,
      userId: belinda.id,
      membershipPlanId: planAktiv.id,
      startsAt: new Date(),
      endsAt: oneYearFromNow,
    },
  });

  // 10. Beispiel-Buchungen anlegen (Heute 10:00 - 11:00 und 14:00 - 15:30)
  const today10 = new Date();
  today10.setHours(10, 0, 0, 0);
  const today11 = new Date();
  today11.setHours(11, 0, 0, 0);

  await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      courtId: court1.id,
      organizerId: roger.id,
      startsAt: today10,
      endsAt: today11,
      status: BookingStatus.CONFIRMED,
      bookingType: BookingType.MEMBER,
      createdById: roger.id,
      notes: "Einzel Match",
      participants: {
        create: [
          {
            userId: roger.id,
            role: ParticipantRole.ORGANIZER,
            invitationStatus: InvitationStatus.ACCEPTED,
          },
          {
            userId: stan.id,
            role: ParticipantRole.PLAYER,
            invitationStatus: InvitationStatus.ACCEPTED,
          },
        ],
      },
    },
  });

  console.log("✅ Seeding erfolgreich abgeschlossen!");
  console.log(`- Platform Admin: ${platformAdmin.email} (PW: admin12345)`);
  console.log(`- Club Admin:     ${clubAdmin.email} (PW: tennis12345)`);
  console.log(`- Demo Club:      ${tenant.name} (/c/${tenant.slug})`);
  console.log(`- 4 Plätze & 3 Mitglieder angelegt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
