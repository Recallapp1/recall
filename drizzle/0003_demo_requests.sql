CREATE TABLE "demo_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"clinic_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"clinic_type" text NOT NULL,
	"message" text,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "demo_requests_created_at_index" ON "demo_requests" USING btree ("created_at");