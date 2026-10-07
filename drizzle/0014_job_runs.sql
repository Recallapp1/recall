CREATE TABLE "job_run_clinics" (
	"run_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_run_clinics_run_id_clinic_id_pk" PRIMARY KEY("run_id","clinic_id")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"run_on" date NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"invocations" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_run_clinics" ADD CONSTRAINT "job_run_clinics_run_id_job_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."job_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_run_clinics" ADD CONSTRAINT "job_run_clinics_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_job_run_on_index" ON "job_runs" USING btree ("job","run_on");--> statement-breakpoint
CREATE INDEX "job_runs_job_finished_at_index" ON "job_runs" USING btree ("job","finished_at");