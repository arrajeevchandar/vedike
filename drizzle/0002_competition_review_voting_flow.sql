ALTER TYPE "competition_lifecycle" ADD VALUE IF NOT EXISTS 'APPLICATIONS_OPEN';
--> statement-breakpoint
ALTER TYPE "competition_lifecycle" ADD VALUE IF NOT EXISTS 'VOTING_OPEN';
--> statement-breakpoint
ALTER TYPE "submission_state" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "application_starts_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "application_ends_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "voting_starts_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "voting_ends_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "applications_opened_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "voting_opened_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "phase_workflow_run_id" text;
--> statement-breakpoint
UPDATE "competitions"
SET "application_starts_at" = "starts_at",
    "application_ends_at" = "starts_at",
    "voting_starts_at" = "starts_at",
    "voting_ends_at" = "ends_at",
    "applications_opened_at" = "created_at",
    "voting_opened_at" = "created_at"
WHERE "application_starts_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "application_starts_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "application_ends_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "voting_starts_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "voting_ends_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competition_phase_date_order" CHECK ("application_starts_at" <= "application_ends_at" AND "application_ends_at" <= "voting_starts_at" AND "voting_starts_at" < "voting_ends_at");
