CREATE TABLE "member_preferences" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"start_page" text DEFAULT 'bugun' NOT NULL,
	"calendar_view" text,
	"calendar_practitioner_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_preferences" ADD CONSTRAINT "member_preferences_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_preferences" ADD CONSTRAINT "member_preferences_calendar_practitioner_id_practitioners_id_fk" FOREIGN KEY ("calendar_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE set null ON UPDATE no action;