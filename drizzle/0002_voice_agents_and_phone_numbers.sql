CREATE TYPE "public"."voice_agent_status" AS ENUM('pending', 'synced', 'error');--> statement-breakpoint
CREATE TABLE "phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"e164" text NOT NULL,
	"provider" text NOT NULL,
	"carrier" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_numbers_e164_unique" UNIQUE("e164")
);
--> statement-breakpoint
CREATE TABLE "voice_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_agent_id" text,
	"external_llm_id" text,
	"agent_version" integer,
	"spec_hash" text,
	"status" "voice_agent_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_agents_clinicId_unique" UNIQUE("clinic_id"),
	CONSTRAINT "voice_agents_externalAgentId_unique" UNIQUE("external_agent_id")
);
--> statement-breakpoint
ALTER TABLE "clinics" DROP CONSTRAINT "clinics_phoneNumber_unique";--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_agents" ADD CONSTRAINT "voice_agents_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_numbers_clinic_id_index" ON "phone_numbers" USING btree ("clinic_id");--> statement-breakpoint
-- Data step (hand-written): move existing clinic numbers before dropping the column.
INSERT INTO "phone_numbers" ("clinic_id", "e164", "provider")
SELECT "id", "phone_number", 'retell' FROM "clinics" WHERE "phone_number" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "clinics" DROP COLUMN "phone_number";