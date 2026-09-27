-- ==============================================================================
-- PostgreSQL Exclusion Constraint zur Verhinderung von Doppelbuchungen
-- ==============================================================================
-- Diese Migration wird auf der PostgreSQL-Datenbank (Neon) ausgeführt.
-- Sie stellt auf Datenbankebene sicher, dass niemals zwei aktive Buchungen
-- denselben Platz zur selben Zeit belegen können.

-- 1. Extension für Kombination aus Gleichheit (=) und Zeitbereich (&&) aktivieren
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Exclusion Constraint hinzufügen (idempotent)
-- Nur für aktive Buchungsstatus ('CONFIRMED', 'PENDING')
-- Stornierte oder abgelaufene Buchungen blockieren den Slot nicht
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
