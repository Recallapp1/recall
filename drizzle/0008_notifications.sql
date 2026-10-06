CREATE TYPE "public"."notification_channel" AS ENUM('sms');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('appointment_reminder', 'follow_up_reminder');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'skipped', 'unknown');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"channel" "notification_channel" DEFAULT 'sms' NOT NULL,
	"subject_id" uuid NOT NULL,
	"dedupe_key" text NOT NULL,
	"template_key" text NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"skip_reason" text,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider" text,
	"provider_message_id" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_attempts_range" CHECK ("notifications"."attempts" between 0 and 10)
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "sms_opt_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key_index" ON "notifications" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_status_scheduled_for_index" ON "notifications" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "notifications_clinic_id_created_at_index" ON "notifications" USING btree ("clinic_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_subject_id_index" ON "notifications" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "notifications_patient_id_index" ON "notifications" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_clinic_id_id_key" ON "patients" USING btree ("clinic_id","id");--> statement-breakpoint
-- Tenant integrity: a notification can only point at a patient of its own
-- clinic. On patient deletion only patient_id is cleared (clinic_id is NOT
-- NULL), which needs the column list (PostgreSQL 15+). Not in schema.ts:
-- Drizzle cannot express it.
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_clinic_patient_fk"
  FOREIGN KEY ("clinic_id", "patient_id")
  REFERENCES "public"."patients"("clinic_id", "id")
  ON DELETE SET NULL ("patient_id");
