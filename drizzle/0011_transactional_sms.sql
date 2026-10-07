ALTER TYPE "public"."notification_kind" ADD VALUE 'appointment_confirmation';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'appointment_cancellation';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'appointment_rescheduled';