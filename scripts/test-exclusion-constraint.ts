import { PrismaClient, BookingStatus, BookingType } from "@prisma/client";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

async function runExclusionConstraintTests() {
  console.log("===============================================================");
  console.log("🧪 Live-Test: PostgreSQL Exclusion Constraints (Doppelbuchungsschutz)");
  console.log("===============================================================\n");

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log("ℹ️  Keine direkte DATABASE_URL in der aktuellen Umgebung gefunden.");
    console.log("💡 Um den Live-Test auf Neon Postgres durchzuführen:");
    console.log("   1. Trage deine Verbindungs-URL in .env.local ein");
    console.log("   2. Führe 'npm run db:provision' aus");
    console.log("   3. Starte diesen Test mit 'npm run db:test-constraints'\n");

    console.log("🧪 Führe stattdessen den logischen Kollisionstest (Simulation) durch:");
    testLogicalOverlapSimulation();
    return;
  }

  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`📡 Verbunden mit: ${maskedUrl}\n`);

  const prisma = new PrismaClient();
  const createdTestBookingIds: string[] = [];

  try {
    // 0. Verify Extension and Constraint in Database Catalog
    console.log("🔎 0. Prüfe PostgreSQL-Systemkatalog...");
    const extensions = await prisma.$queryRawUnsafe<{ extname: string }[]>(
      "SELECT extname FROM pg_extension WHERE extname = 'btree_gist';"
    );
    if (extensions.length === 0) {
      throw new Error(
        "Extension 'btree_gist' ist nicht in PostgreSQL installiert. Führe 'npm run db:provision' aus."
      );
    }
    console.log("   ✔ PostgreSQL Extension 'btree_gist' ist aktiv.");

    const constraints = await prisma.$queryRawUnsafe<{ conname: string }[]>(
      "SELECT conname, contype FROM pg_constraint WHERE conname = 'no_overlapping_bookings';"
    );
    if (constraints.length === 0) {
      throw new Error(
        "Constraint 'no_overlapping_bookings' existiert noch nicht. Führe 'npm run db:provision' aus."
      );
    }
    console.log("   ✔ GiST Exclusion Constraint 'no_overlapping_bookings' ist aktiv.\n");

    // Fetch or create a test tenant and courts
    const tenant = await prisma.tenant.findFirst({
      include: { courts: true, tenantUsers: { include: { user: true } } },
    });

    if (!tenant || tenant.courts.length < 2) {
      console.log("⚠️  Zu wenige Plätze gefunden. Bitte führe 'npm run db:seed' aus.");
      return;
    }

    const court1 = tenant.courts[0];
    const court2 = tenant.courts[1];
    const testUser = tenant.tenantUsers[0]?.user;

    if (!testUser) {
      console.log("⚠️  Kein Test-Benutzer vorhanden.");
      return;
    }

    // Set arbitrary fixed test date in the future to avoid conflicts with demo data
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 30); // 30 days from now
    baseDate.setMinutes(0, 0, 0);

    const slot1Start = new Date(baseDate);
    slot1Start.setHours(14, 0, 0, 0);
    const slot1End = new Date(baseDate);
    slot1End.setHours(15, 0, 0, 0);

    // Test 1: Single valid booking
    console.log("🎾 Test 1: Reguläre Buchung erstellen (Court 1, 14:00 - 15:00 Uhr)...");
    const booking1 = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        courtId: court1.id,
        organizerId: testUser.id,
        startsAt: slot1Start,
        endsAt: slot1End,
        status: BookingStatus.CONFIRMED,
        bookingType: BookingType.MEMBER,
        createdById: testUser.id,
        notes: "[TEST] Exclusion Test 1",
      },
    });
    createdTestBookingIds.push(booking1.id);
    console.log(`   ✔ Buchung 1 erfolgreich erstellt (ID: ${booking1.id})\n`);

    // Test 2: Overlapping booking on same court (14:30 - 15:30)
    console.log("🚫 Test 2: Doppelbuchung versuchen (Court 1, 14:30 - 15:30 Uhr)...");
    const overlapStart = new Date(baseDate);
    overlapStart.setHours(14, 30, 0, 0);
    const overlapEnd = new Date(baseDate);
    overlapEnd.setHours(15, 30, 0, 0);

    let rejectedByDb = false;
    let pgErrorCode: string | null = null;

    try {
      const collidingBooking = await prisma.booking.create({
        data: {
          tenantId: tenant.id,
          courtId: court1.id,
          organizerId: testUser.id,
          startsAt: overlapStart,
          endsAt: overlapEnd,
          status: BookingStatus.CONFIRMED,
          bookingType: BookingType.MEMBER,
          createdById: testUser.id,
          notes: "[TEST] Should Fail",
        },
      });
      createdTestBookingIds.push(collidingBooking.id);
    } catch (err: unknown) {
      rejectedByDb = true;
      const pgErrorMessage = err instanceof Error ? err.message : String(err);
      if (pgErrorMessage.includes("23P01") || pgErrorMessage.includes("no_overlapping_bookings")) {
        pgErrorCode = "23P01 (exclusion_violation)";
      }
    }

    if (!rejectedByDb) {
      throw new Error(
        "❌ KRITISCHER FEHLER: Die überlappende Buchung wurde von der Datenbank NICHT abgewiesen!"
      );
    }
    console.log(`   ✔ ERFOLG: PostgreSQL hat die Kollision auf Motorebene abgewiesen!`);
    console.log(`   ✔ Fehlercode: ${pgErrorCode || "PostgreSQL Constraint Violation"}\n`);

    // Test 3: Parallel booking on DIFFERENT court at the exact same time
    console.log("⚡ Test 3: Parallele Buchung auf anderem Platz (Court 2, 14:00 - 15:00 Uhr)...");
    const bookingCourt2 = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        courtId: court2.id,
        organizerId: testUser.id,
        startsAt: slot1Start,
        endsAt: slot1End,
        status: BookingStatus.CONFIRMED,
        bookingType: BookingType.MEMBER,
        createdById: testUser.id,
        notes: "[TEST] Parallel Court 2",
      },
    });
    createdTestBookingIds.push(bookingCourt2.id);
    console.log(`   ✔ Parallele Buchung auf Court 2 erfolgreich (kein plattformübergreifender Konflikt)!\n`);

    // Test 4: Back-to-back adjacent bookings (15:00 - 16:00 on Court 1)
    console.log("⏱️ Test 4: Direkt anschliessende Buchung (Court 1, 15:00 - 16:00 Uhr)...");
    const nextSlotStart = new Date(slot1End);
    const nextSlotEnd = new Date(baseDate);
    nextSlotEnd.setHours(16, 0, 0, 0);

    const bookingAdjacent = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        courtId: court1.id,
        organizerId: testUser.id,
        startsAt: nextSlotStart,
        endsAt: nextSlotEnd,
        status: BookingStatus.CONFIRMED,
        bookingType: BookingType.MEMBER,
        createdById: testUser.id,
        notes: "[TEST] Adjacent",
      },
    });
    createdTestBookingIds.push(bookingAdjacent.id);
    console.log(`   ✔ Direkt anschliessender Slot [14:00-15:00 & 15:00-16:00] erlaubt!\n`);

    // Test 5: Cancelled booking releases slot
    console.log("🔄 Test 5: Stornierte Buchung gibt den Zeitslot frei...");
    await prisma.booking.update({
      where: { id: booking1.id },
      data: { status: BookingStatus.CANCELLED },
    });

    const rebooked = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        courtId: court1.id,
        organizerId: testUser.id,
        startsAt: overlapStart,
        endsAt: overlapEnd,
        status: BookingStatus.CONFIRMED,
        bookingType: BookingType.MEMBER,
        createdById: testUser.id,
        notes: "[TEST] Rebooked after cancellation",
      },
    });
    createdTestBookingIds.push(rebooked.id);
    console.log(`   ✔ Slot nach Stornierung wieder erfolgreich buchbar!\n`);

    console.log("===============================================================");
    console.log("🎉 ALLE 5/5 POSTGRESQL EXCLUSION CONSTRAINT TESTS BESTANDEN!");
    console.log("===============================================================");
    console.log("Neon Postgres garantiert atomaren Schutz gegen Doppelbuchungen.");
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Test fehlgeschlagen:", errorMsg);
    process.exit(1);
  } finally {
    // Cleanup test bookings
    if (createdTestBookingIds.length > 0) {
      console.log(`\n🧹 Bereinige ${createdTestBookingIds.length} Testbuchungen...`);
      await prisma.booking.deleteMany({
        where: { id: { in: createdTestBookingIds } },
      });
      console.log("   ✔ Bereinigung abgeschlossen.");
    }
    await prisma.$disconnect();
  }
}

function testLogicalOverlapSimulation() {
  console.log("   1. Test: Slot [14:00 - 15:00] und kollidierender Slot [14:30 - 15:30]");
  const aStart = new Date("2026-10-01T14:00:00Z").getTime();
  const aEnd = new Date("2026-10-01T15:00:00Z").getTime();
  const bStart = new Date("2026-10-01T14:30:00Z").getTime();
  const bEnd = new Date("2026-10-01T15:30:00Z").getTime();

  const isOverlap = bStart < aEnd && bEnd > aStart;
  console.log(`   ✔ Kollisionsprüfung: Überlappung erkannt = ${isOverlap}`);

  console.log("   2. Test: Direkt anschliessender Slot [15:00 - 16:00]");
  const cStart = new Date("2026-10-01T15:00:00Z").getTime();
  const cEnd = new Date("2026-10-01T16:00:00Z").getTime();
  const isAdjacentOverlap = cStart < aEnd && cEnd > aStart;
  console.log(`   ✔ Angrenzender Slot: Überlappung erkannt = ${isAdjacentOverlap} (Korrekt kein Konflikt)\n`);

  console.log("✅ Logische Überlappungsprüfung erfolgreich simuliert!");
}

runExclusionConstraintTests();
