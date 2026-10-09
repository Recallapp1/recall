ALTER TABLE "calls" ADD COLUMN "flags" text[];--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "flagged_at" timestamp with time zone;