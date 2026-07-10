CREATE TYPE "public"."competition_lifecycle" AS ENUM('PUBLISHED', 'CLOSING', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."payment_state" AS ENUM('CREATED', 'PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED', 'REVIEW_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."publication_state" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."submission_state" AS ENUM('VISIBLE', 'HIDDEN', 'DISQUALIFIED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"vote_count_snapshot" integer NOT NULL,
	"tie_break_at" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "winner_rank_range" CHECK ("competition_winners"."rank" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"glyph" text DEFAULT 'ಕ' NOT NULL,
	"banner" text NOT NULL,
	"banner_url" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"lifecycle" "competition_lifecycle" DEFAULT 'PUBLISHED' NOT NULL,
	"max_entries_per_participant" integer DEFAULT 1,
	"is_showcase" boolean DEFAULT false NOT NULL,
	"showcase_status" text,
	"completion_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "competition_date_order" CHECK ("competitions"."ends_at" > "competitions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "entry_identity_counters" (
	"competition_id" uuid NOT NULL,
	"identity_hash" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"glyph" text DEFAULT 'ವೇ' NOT NULL,
	"banner" text NOT NULL,
	"banner_url" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"publication_state" "publication_state" DEFAULT 'PUBLISHED' NOT NULL,
	"is_showcase" boolean DEFAULT false NOT NULL,
	"showcase_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_date_order" CHECK ("events"."ends_at" > "events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_order_id" uuid,
	"provider_event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_provider_event_key_unique" UNIQUE("provider_event_key")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"participant_name" text NOT NULL,
	"participant_phone_encrypted" text,
	"participant_phone_hash" text,
	"participant_email_encrypted" text,
	"participant_email_hash" text,
	"description" text NOT NULL,
	"image_url" text,
	"image_key" text,
	"tile" text NOT NULL,
	"glyph" text DEFAULT 'ಹೊ' NOT NULL,
	"state" "submission_state" DEFAULT 'VISIBLE' NOT NULL,
	"paid_vote_count" integer DEFAULT 0 NOT NULL,
	"showcase_vote_count" integer DEFAULT 0 NOT NULL,
	"last_vote_reached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"status_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"merchant_order_id" text NOT NULL,
	"phonepe_order_id" text,
	"voter_name_encrypted" text NOT NULL,
	"voter_phone_encrypted" text NOT NULL,
	"voter_phone_hash" text NOT NULL,
	"amount_paise" integer DEFAULT 200 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"state" "payment_state" DEFAULT 'CREATED' NOT NULL,
	"checkout_url" text,
	"failure_code" text,
	"workflow_run_id" text,
	"refund_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"credited_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_orders_client_request_id_unique" UNIQUE("client_request_id"),
	CONSTRAINT "vote_orders_status_token_unique" UNIQUE("status_token"),
	CONSTRAINT "vote_orders_merchant_order_id_unique" UNIQUE("merchant_order_id"),
	CONSTRAINT "vote_orders_phonepe_order_id_unique" UNIQUE("phonepe_order_id"),
	CONSTRAINT "vote_amount_fixed" CHECK ("vote_orders"."amount_paise" = 200)
);
--> statement-breakpoint
ALTER TABLE "competition_winners" ADD CONSTRAINT "competition_winners_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_winners" ADD CONSTRAINT "competition_winners_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_identity_counters" ADD CONSTRAINT "entry_identity_counters_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_vote_order_id_vote_orders_id_fk" FOREIGN KEY ("vote_order_id") REFERENCES "public"."vote_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_orders" ADD CONSTRAINT "vote_orders_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_orders" ADD CONSTRAINT "vote_orders_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_rank_unique" ON "competition_winners" USING btree ("competition_id","rank");--> statement-breakpoint
CREATE INDEX "competitions_event_idx" ON "competitions" USING btree ("event_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_identity_unique" ON "entry_identity_counters" USING btree ("competition_id","identity_hash");--> statement-breakpoint
CREATE INDEX "events_public_idx" ON "events" USING btree ("publication_state","starts_at");--> statement-breakpoint
CREATE INDEX "submissions_competition_idx" ON "submissions" USING btree ("competition_id","state");--> statement-breakpoint
CREATE INDEX "submissions_phone_idx" ON "submissions" USING btree ("competition_id","participant_phone_hash");--> statement-breakpoint
CREATE INDEX "submissions_email_idx" ON "submissions" USING btree ("competition_id","participant_email_hash");--> statement-breakpoint
CREATE INDEX "vote_orders_competition_idx" ON "vote_orders" USING btree ("competition_id","state");--> statement-breakpoint
CREATE INDEX "vote_orders_phone_idx" ON "vote_orders" USING btree ("voter_phone_hash","state");