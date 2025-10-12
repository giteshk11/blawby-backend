ALTER TABLE "stripe_onboarding_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "stripe_onboarding_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "payment_intents" DROP CONSTRAINT "payment_intents_connected_account_id_stripe_connected_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_intents" DROP CONSTRAINT "payment_intents_customer_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_intents" DROP CONSTRAINT "payment_intents_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "payouts" DROP CONSTRAINT "payouts_connected_account_id_stripe_connected_accounts_id_fk";
--> statement-breakpoint
DROP INDEX "payment_intents_connected_account_id_idx";--> statement-breakpoint
DROP INDEX "payment_intents_customer_id_idx";--> statement-breakpoint
DROP INDEX "payment_intents_invoice_id_idx";--> statement-breakpoint
DROP INDEX "payment_intents_status_idx";--> statement-breakpoint
DROP INDEX "payment_intents_created_at_idx";--> statement-breakpoint
DROP INDEX "payment_intents_succeeded_at_idx";--> statement-breakpoint
DROP INDEX "payment_intents_stripe_payment_intent_id_idx";--> statement-breakpoint
DROP INDEX "payment_intents_org_status_idx";--> statement-breakpoint
DROP INDEX "payment_intents_org_created_idx";--> statement-breakpoint
DROP INDEX "payouts_connected_account_id_idx";--> statement-breakpoint
DROP INDEX "payouts_status_idx";--> statement-breakpoint
DROP INDEX "payouts_created_at_idx";--> statement-breakpoint
DROP INDEX "payouts_paid_at_idx";--> statement-breakpoint
DROP INDEX "payouts_stripe_payout_id_idx";--> statement-breakpoint
DROP INDEX "payouts_org_status_idx";