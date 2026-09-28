import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const TENANT_ID = "tc-marly"
const LOCATION_ID = "loc-marly"

const MEMBERSHIP_PLANS = [
  { id: "actif-2026", name: "Actif (Erwachsene)", price: 350, description: "Volle Spielberechtigung." },
  { id: "etudiant-2026", name: "Etudiant (19-25 J.)", price: 250, description: "Gültiger Ausweis erforderlich." },
  { id: "junior-2026", name: "Junior (bis 18 J.)", price: 150, description: "Für den Nachwuchs." },
  { id: "famille-2026", name: "Famille (Paar + Kinder)", price: 750, description: "Das komplette Paket für Familien." },
  { id: "guest-pass", name: "Gast (Pay & Play)", price: 0, description: "Ohne Grundgebühr, pro Platz zahlen." },
]

const COURTS = [
  { id: "court-marly-1", name: "Platz 1 (Allwetter)", sportType: "TENNIS", surface: "HARD", hasLighting: true, sortOrder: 1 },
  { id: "court-marly-2", name: "Platz 2 (Allwetter)", sportType: "TENNIS", surface: "HARD", hasLighting: true, sortOrder: 2 },
  { id: "court-marly-3", name: "Platz 3 (Sand - Center)", sportType: "TENNIS", surface: "CLAY", hasLighting: true, sortOrder: 3 },
  { id: "court-marly-4", name: "Platz 4 (Sand)", sportType: "TENNIS", surface: "CLAY", hasLighting: true, sortOrder: 4 },
  { id: "court-marly-5", name: "Platz 5 (Sand)", sportType: "TENNIS", surface: "CLAY", hasLighting: false, sortOrder: 5 },
  { id: "court-marly-6", name: "Platz 6 (Sand)", sportType: "TENNIS", surface: "CLAY", hasLighting: false, sortOrder: 6 },
  { id: "court-marly-7", name: "Platz 7 (Sand)", sportType: "TENNIS", surface: "CLAY", hasLighting: true, sortOrder: 7 },
  { id: "court-marly-8", name: "Platz 8 (Sand)", sportType: "TENNIS", surface: "CLAY", hasLighting: true, sortOrder: 8 },
  { id: "court-marly-9", name: "Padel 1 (Panoramaplatz)", sportType: "PADEL", surface: "ARTIFICIAL_GRASS", hasLighting: true, sortOrder: 9 },
]

const DEMO_GUESTS = [
  { email: "gast@marly.ch", name: "Test Gast" },
  { email: "future.member@marly.ch", name: "Future Member" },
]

async function main() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: "Tennis Club Marly",
      slug: TENANT_ID,
      status: "ACTIVE",
      timezone: "Europe/Zurich",
    },
  })

  await prisma.tenant.update({
    where: { id: TENANT_ID },
    data: {
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
  })

  for (const plan of MEMBERSHIP_PLANS) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: { price: plan.price, name: plan.name, description: plan.description },
      create: {
        id: plan.id,
        tenantId: TENANT_ID,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: "CHF",
        status: "ACTIVE",
        simultaneousBookingLimit: 4,
      },
    })
  }

  await prisma.location.upsert({
    where: { id: LOCATION_ID },
    update: {},
    create: {
      id: LOCATION_ID,
      tenant: { connect: { id: TENANT_ID } },
      name: "TC Marly Anlage",
      address: "Route de la Gérine 1, 1723 Marly",
    },
  })

  await prisma.court.deleteMany({ where: { tenantId: TENANT_ID } })
  for (const c of COURTS) {
    await prisma.court.create({
      data: {
        id: c.id,
        tenantId: TENANT_ID,
        locationId: LOCATION_ID,
        name: c.name,
        sportType: c.sportType as any,
        surface: c.surface as any,
        isIndoor: false,
        hasLighting: c.hasLighting,
        status: "ACTIVE",
        sortOrder: c.sortOrder,
      },
    })
  }

  const adminPassHash = await hash("admin12345", 10)
  await prisma.user.upsert({
    where: { email: "admin@tennisapp.ch" },
    update: { passwordHash: adminPassHash },
    create: {
      email: "admin@tennisapp.ch",
      firstName: "Platform",
      lastName: "Admin",
      passwordHash: adminPassHash,
      tenantUsers: { create: { tenantId: TENANT_ID, role: "PLATFORM_ADMIN" } },
    },
  })
  await prisma.user.upsert({
    where: { email: "clubadmin@marly.ch" },
    update: { passwordHash: adminPassHash },
    create: {
      email: "clubadmin@marly.ch",
      firstName: "Marly",
      lastName: "Vorstand",
      passwordHash: adminPassHash,
      tenantUsers: { create: { tenantId: TENANT_ID, role: "CLUB_ADMIN" } },
    },
  })

  const guestPassHash = await hash("tennis12345", 10)
  for (const g of DEMO_GUESTS) {
    const user = await prisma.user.upsert({
      where: { email: g.email },
      update: { passwordHash: guestPassHash },
      create: {
        email: g.email,
        firstName: g.name.split(' ')[0],
        lastName: g.name.split(' ')[1] || '',
        passwordHash: guestPassHash,
      },
    })
    await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: TENANT_ID, userId: user.id } },
      update: {},
      create: { tenantId: TENANT_ID, userId: user.id, role: "GUEST" },
    })
  }

  console.log("Database seeded successfully!")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
