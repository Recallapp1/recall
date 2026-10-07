-- Composite tenant foreign keys for the tables that predate Takip (docs/HARDENING-2026-10.md).
-- Targets first: a composite foreign key needs a unique (clinic_id, id) to point at.
CREATE UNIQUE INDEX "calls_clinic_id_id_key" ON "calls" USING btree ("clinic_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "practitioners_clinic_id_id_key" ON "practitioners" USING btree ("clinic_id","id");--> statement-breakpoint
-- practitioner_services gets the clinic of its practitioner (verified: no row mixes clinics).
ALTER TABLE "practitioner_services" ADD COLUMN "clinic_id" uuid;--> statement-breakpoint
UPDATE "practitioner_services" SET "clinic_id" = p."clinic_id" FROM "practitioners" p WHERE p."id" = "practitioner_services"."practitioner_id";--> statement-breakpoint
ALTER TABLE "practitioner_services" ALTER COLUMN "clinic_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "practitioner_services" ADD CONSTRAINT "practitioner_services_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_services" ADD CONSTRAINT "practitioner_services_practitioner_fk" FOREIGN KEY ("clinic_id","practitioner_id") REFERENCES "public"."practitioners"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_services" ADD CONSTRAINT "practitioner_services_service_fk" FOREIGN KEY ("clinic_id","service_id") REFERENCES "public"."services"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_fk" FOREIGN KEY ("clinic_id","patient_id") REFERENCES "public"."patients"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practitioner_fk" FOREIGN KEY ("clinic_id","practitioner_id") REFERENCES "public"."practitioners"("clinic_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_fk" FOREIGN KEY ("clinic_id","service_id") REFERENCES "public"."services"("clinic_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- SET NULL (call_id) only: clinic_id is NOT NULL and must survive the call's deletion.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_call_fk" FOREIGN KEY ("clinic_id","call_id") REFERENCES "public"."calls"("clinic_id","id") ON DELETE SET NULL ("call_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_call_fk" FOREIGN KEY ("clinic_id","call_id") REFERENCES "public"."calls"("clinic_id","id") ON DELETE SET NULL ("call_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_practitioner_fk" FOREIGN KEY ("clinic_id","practitioner_id") REFERENCES "public"."practitioners"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_practitioner_fk" FOREIGN KEY ("clinic_id","practitioner_id") REFERENCES "public"."practitioners"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- members belong to an organization, not a clinic: a trigger keeps a member's
-- practitioner link (and calendar preference) inside the member's own clinic.
CREATE FUNCTION "member_practitioner_same_clinic"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  practitioner uuid;
  member_org uuid;
BEGIN
  IF TG_TABLE_NAME = 'members' THEN
    practitioner := NEW."practitioner_id";
    member_org := NEW."organization_id";
  ELSE
    practitioner := NEW."calendar_practitioner_id";
    SELECT m."organization_id" INTO member_org FROM "members" m WHERE m."id" = NEW."member_id";
  END IF;
  IF practitioner IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "practitioners" p JOIN "clinics" c ON c."id" = p."clinic_id"
    WHERE p."id" = practitioner AND c."organization_id" = member_org
  ) THEN
    RAISE EXCEPTION 'practitioner % is not in the member''s clinic', practitioner
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "members_practitioner_same_clinic" BEFORE INSERT OR UPDATE OF "practitioner_id", "organization_id" ON "members" FOR EACH ROW EXECUTE FUNCTION "member_practitioner_same_clinic"();--> statement-breakpoint
CREATE TRIGGER "member_preferences_practitioner_same_clinic" BEFORE INSERT OR UPDATE OF "calendar_practitioner_id", "member_id" ON "member_preferences" FOR EACH ROW EXECUTE FUNCTION "member_practitioner_same_clinic"();
