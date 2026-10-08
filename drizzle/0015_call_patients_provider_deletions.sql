CREATE TABLE "call_patients" (
	"clinic_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_patients_call_id_patient_id_pk" PRIMARY KEY("call_id","patient_id")
);
--> statement-breakpoint
CREATE TABLE "provider_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_call_id" text NOT NULL,
	"reason" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_patients" ADD CONSTRAINT "call_patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_patients" ADD CONSTRAINT "call_patients_call_fk" FOREIGN KEY ("clinic_id","call_id") REFERENCES "public"."calls"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_patients" ADD CONSTRAINT "call_patients_patient_fk" FOREIGN KEY ("clinic_id","patient_id") REFERENCES "public"."patients"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_deletions" ADD CONSTRAINT "provider_deletions_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_patients_clinic_id_patient_id_index" ON "call_patients" USING btree ("clinic_id","patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_deletions_provider_provider_call_id_index" ON "provider_deletions" USING btree ("provider","provider_call_id");--> statement-breakpoint
CREATE INDEX "provider_deletions_due_idx" ON "provider_deletions" USING btree ("next_attempt_at") WHERE "provider_deletions"."done_at" is null;--> statement-breakpoint
-- Backfill: every appointment a call created links that call to its patient.
INSERT INTO "call_patients" ("clinic_id", "call_id", "patient_id")
SELECT DISTINCT "clinic_id", "call_id", "patient_id" FROM "appointments" WHERE "call_id" IS NOT NULL
ON CONFLICT DO NOTHING;
