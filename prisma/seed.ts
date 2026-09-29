import { PrismaClient, SportType, CourtSurface } from '@prisma/client'
import { hash } from 'bcryptjs'
import { TCM_PLANS } from './tcm-plans'

const prisma = new PrismaClient()

const TENANT_ID = "tc-marly"
const LOCATION_ID = "loc-marly"


const COURTS: { id: string; name: string; sportType: SportType; surface: CourtSurface; hasLighting: boolean; sortOrder: number }[] = [
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

const DEMO_GUESTS: { email: string; name: string; role: "MEMBER" | "GUEST" }[] = [
  { email: "member@marly.ch", name: "Roger Federer", role: "MEMBER" },
  { email: "gast@marly.ch", name: "Test Gast", role: "GUEST" },
  { email: "future.member@marly.ch", name: "Future Member", role: "GUEST" },
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

  for (const { id, ...plan } of TCM_PLANS) {
    await prisma.membershipPlan.upsert({
      where: { id },
      update: plan,
      create: { id, tenantId: TENANT_ID, currency: "CHF", status: "ACTIVE", ...plan },
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
        sportType: c.sportType,
        surface: c.surface,
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
      update: { role: g.role },
      create: { tenantId: TENANT_ID, userId: user.id, role: g.role },
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
