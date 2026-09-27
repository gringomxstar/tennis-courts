import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Load .env.local or .env if exists
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

async function provisionDatabase() {
  console.log("===============================================================");
  console.log("🚀 Neon PostgreSQL Provisionierung & Setup");
  console.log("===============================================================\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ Keine DATABASE_URL Umgebungsvariable gefunden!");
    console.log("\n💡 Bitte trage deine Neon Postgres Verbindungszeichenfolge in .env.local ein:");
    console.log('   DATABASE_URL="postgresql://user:password@ep-pooler.region.aws.neon.tech/neondb?sslmode=require"');
    console.log('   DIRECT_URL="postgresql://user:password@ep-direct.region.aws.neon.tech/neondb?sslmode=require"\n');
    console.log("Führe anschließend 'npm run db:provision' erneut aus.");
    process.exit(1);
  }

  // Obfuscate credentials for display
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`📡 Verbinde mit PostgreSQL: ${maskedUrl}`);

  const prisma = new PrismaClient();

  try {
    // 1. Connection check
    const [versionResult]: any[] = await prisma.$queryRawUnsafe("SELECT version();");
    console.log(`✅ Verbindung erfolgreich! PostgreSQL-Version:`);
    console.log(`   ${versionResult.version.split(",")[0]}\n`);

    // 2. Push schema to Neon
    console.log("📦 1. Synchronisiere Prisma Schema mit Neon DB (prisma db push)...");
    try {
      execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
      console.log("✅ Schema-Synchronisierung abgeschlossen!\n");
    } catch (pushErr) {
      console.error("❌ Fehler beim Schema-Push:", pushErr);
      throw pushErr;
    }

    // 3. Apply PostgreSQL Exclusion Constraint & Extension
    console.log("🔒 2. Aktiviere btree_gist Extension & PostgreSQL Exclusion Constraints...");
    const sqlPath = path.resolve(process.cwd(), "prisma/exclusion_constraint.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");

    // Execute extension
    await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS btree_gist;");
    console.log("   ✔ PostgreSQL Extension 'btree_gist' aktiviert.");

    // Execute constraint
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_bookings'
        ) THEN
          ALTER TABLE bookings
          ADD CONSTRAINT no_overlapping_bookings
          EXCLUDE USING gist (
            court_id WITH =,
            tstzrange(starts_at, ends_at) WITH &&
          )
          WHERE (status IN ('CONFIRMED', 'PENDING'));
        END IF;
      END $$;
    `);
    console.log("   ✔ Exclusion Constraint 'no_overlapping_bookings' erfolgreich auf Tabelle 'bookings' angelegt!\n");

    // 4. Seed initial data
    console.log("🌱 3. Führe Seeding aus (Clubs, Plätze, Tarife, Demodaten)...");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });

    console.log("\n===============================================================");
    console.log("🎉 Neon PostgreSQL Datenbank erfolgreich provisioniert!");
    console.log("===============================================================");
    console.log("Du kannst den Ausschluss-Constraint jetzt live testen mit:");
    console.log("👉 npm run db:test-constraints\n");
  } catch (err: any) {
    console.error("\n❌ Fehler bei der Provisionierung:", err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

provisionDatabase();
