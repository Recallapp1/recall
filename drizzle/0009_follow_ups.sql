CREATE TYPE "public"."follow_up_interval_unit" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "public"."follow_up_state" AS ENUM('active', 'paused', 'stopped', 'completed');--> statement-breakpoint
CREATE TYPE "public"."follow_up_visit_source" AS ENUM('start', 'auto_link', 'staff_link', 'manual');--> statement-breakpoint
CREATE TABLE "follow_up_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"name" text NOT NULL,
	"visit_service_id" uuid NOT NULL,
	"interval_value" smallint NOT NULL,
	"interval_unit" "follow_up_interval_unit" NOT NULL,
	"total_visits" smallint,
	"state" "follow_up_state" DEFAULT 'active' NOT NULL,
	"started_on" date NOT NULL,
	"due_override_on" date,
	"due_override_at" timestamp with time zone,
	"next_due_on" date,
	"visits_done" smallint DEFAULT 0 NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"sms_consent_at" timestamp with time zone,
	"sms_consent_by" uuid,
	"stopped_reason" text,
	"state_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_plans_interval_positive" CHECK ("follow_up_plans"."interval_value" > 0),
	CONSTRAINT "follow_up_plans_override_pair" CHECK (("follow_up_plans"."due_override_on" is null) = ("follow_up_plans"."due_override_at" is null)),
	CONSTRAINT "follow_up_plans_stop_reason" CHECK (("follow_up_plans"."state" = 'stopped') = ("follow_up_plans"."stopped_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "follow_up_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger_service_id" uuid,
	"visit_service_id" uuid NOT NULL,
	"interval_value" smallint,
	"interval_unit" "follow_up_interval_unit",
	"total_visits" smallint,
	"auto_start" boolean DEFAULT false NOT NULL,
	"sms_reminders" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"template_key" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_rules_interval_range" CHECK ("follow_up_rules"."interval_value" is null or ("follow_up_rules"."interval_unit" = 'day' and "follow_up_rules"."interval_value" between 1 and 730) or ("follow_up_rules"."interval_unit" = 'week' and "follow_up_rules"."interval_value" between 1 and 104) or ("follow_up_rules"."interval_unit" = 'month' and "follow_up_rules"."interval_value" between 1 and 36)),
	CONSTRAINT "follow_up_rules_interval_pair" CHECK (("follow_up_rules"."interval_value" is null) = ("follow_up_rules"."interval_unit" is null)),
	CONSTRAINT "follow_up_rules_total_range" CHECK ("follow_up_rules"."total_visits" is null or "follow_up_rules"."total_visits" between 1 and 50),
	CONSTRAINT "follow_up_rules_active_valid" CHECK (not "follow_up_rules"."is_active" or ("follow_up_rules"."interval_value" is not null and "follow_up_rules"."archived_at" is null))
);
--> statement-breakpoint
CREATE TABLE "follow_up_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"appointment_id" uuid,
	"visited_on" date,
	"source" "follow_up_visit_source" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_visits_has_date" CHECK ("follow_up_visits"."appointment_id" is not null or "follow_up_visits"."visited_on" is not null)
);
--> statement-breakpoint
-- Composite foreign keys below need these targets to exist first.
CREATE UNIQUE INDEX "follow_up_plans_clinic_id_id_key" ON "follow_up_plans" USING btree ("clinic_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_rules_clinic_id_id_key" ON "follow_up_rules" USING btree ("clinic_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_clinic_id_id_key" ON "appointments" USING btree ("clinic_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "services_clinic_id_id_key" ON "services" USING btree ("clinic_id","id");
--> statement-breakpoint
ALTER TABLE "follow_up_plans" ADD CONSTRAINT "follow_up_plans_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_plans" ADD CONSTRAINT "follow_up_plans_sms_consent_by_users_id_fk" FOREIGN KEY ("sms_consent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_plans" ADD CONSTRAINT "follow_up_plans_patient_fk" FOREIGN KEY ("clinic_id","patient_id") REFERENCES "public"."patients"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_plans" ADD CONSTRAINT "follow_up_plans_rule_fk" FOREIGN KEY ("clinic_id","rule_id") REFERENCES "public"."follow_up_rules"("clinic_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_plans" ADD CONSTRAINT "follow_up_plans_visit_service_fk" FOREIGN KEY ("clinic_id","visit_service_id") REFERENCES "public"."services"("clinic_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_rules" ADD CONSTRAINT "follow_up_rules_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_rules" ADD CONSTRAINT "follow_up_rules_trigger_service_fk" FOREIGN KEY ("clinic_id","trigger_service_id") REFERENCES "public"."services"("clinic_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_rules" ADD CONSTRAINT "follow_up_rules_visit_service_fk" FOREIGN KEY ("clinic_id","visit_service_id") REFERENCES "public"."services"("clinic_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_visits" ADD CONSTRAINT "follow_up_visits_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_visits" ADD CONSTRAINT "follow_up_visits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_visits" ADD CONSTRAINT "follow_up_visits_plan_fk" FOREIGN KEY ("clinic_id","plan_id") REFERENCES "public"."follow_up_plans"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_visits" ADD CONSTRAINT "follow_up_visits_appointment_fk" FOREIGN KEY ("clinic_id","appointment_id") REFERENCES "public"."appointments"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_plans_open_key" ON "follow_up_plans" USING btree ("patient_id","rule_id") WHERE "follow_up_plans"."state" in ('active', 'paused');--> statement-breakpoint
CREATE INDEX "follow_up_plans_clinic_id_state_next_due_on_index" ON "follow_up_plans" USING btree ("clinic_id","state","next_due_on");--> statement-breakpoint
CREATE INDEX "follow_up_plans_patient_id_index" ON "follow_up_plans" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "follow_up_rules_clinic_id_index" ON "follow_up_rules" USING btree ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_visits_appointment_id_index" ON "follow_up_visits" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "follow_up_visits_plan_id_index" ON "follow_up_visits" USING btree ("plan_id");