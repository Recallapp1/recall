CREATE TABLE "tool_requests" (
	"clinic_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"request_key" text NOT NULL,
	"tool" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_requests_call_id_request_key_pk" PRIMARY KEY("call_id","request_key")
);
--> statement-breakpoint
ALTER TABLE "tool_requests" ADD CONSTRAINT "tool_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_requests" ADD CONSTRAINT "tool_requests_call_fk" FOREIGN KEY ("clinic_id","call_id") REFERENCES "public"."calls"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_requests_created_at_index" ON "tool_requests" USING btree ("created_at");