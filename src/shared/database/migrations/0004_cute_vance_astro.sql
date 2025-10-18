ALTER TABLE "webhook_events" ADD COLUMN "error_stack" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "next_retry_at" timestamp;