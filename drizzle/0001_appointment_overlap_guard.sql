-- Prevents double booking at the database level: two active appointments for
-- the same practitioner can never overlap, even under concurrent calls.
-- Mirrors ACTIVE_APPOINTMENT_STATUSES in src/server/db/schema.ts.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "practitioner_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" IN ('scheduled', 'confirmed'));
