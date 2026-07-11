import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const publicationStateEnum = pgEnum("publication_state", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const competitionLifecycleEnum = pgEnum("competition_lifecycle", ["PUBLISHED", "CLOSING", "COMPLETED", "ARCHIVED"]);
export const submissionStateEnum = pgEnum("submission_state", ["VISIBLE", "HIDDEN", "DISQUALIFIED", "ARCHIVED"]);
export const paymentStateEnum = pgEnum("payment_state", ["CREATED", "PENDING", "COMPLETED", "FAILED", "EXPIRED", "REFUND_PENDING", "REFUNDED", "REVIEW_REQUIRED"]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  glyph: text("glyph").notNull().default("ವೇ"),
  banner: text("banner").notNull(),
  bannerUrl: text("banner_url"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  publicationState: publicationStateEnum("publication_state").notNull().default("PUBLISHED"),
  isShowcase: boolean("is_showcase").notNull().default(false),
  showcaseStatus: text("showcase_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("event_date_order", sql`${t.endsAt} > ${t.startsAt}`), index("events_public_idx").on(t.publicationState, t.startsAt)]);

export const competitions = pgTable("competitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rules: jsonb("rules").$type<string[]>().notNull().default([]),
  glyph: text("glyph").notNull().default("ಕ"),
  banner: text("banner").notNull(),
  bannerUrl: text("banner_url"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  lifecycle: competitionLifecycleEnum("lifecycle").notNull().default("PUBLISHED"),
  maxEntriesPerParticipant: integer("max_entries_per_participant").default(1),
  isShowcase: boolean("is_showcase").notNull().default(false),
  showcaseStatus: text("showcase_status"),
  completionStartedAt: timestamp("completion_started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("competition_date_order", sql`${t.endsAt} > ${t.startsAt}`), check("competition_entry_limit_positive", sql`${t.maxEntriesPerParticipant} is null or ${t.maxEntriesPerParticipant} > 0`), index("competitions_event_idx").on(t.eventId, t.startsAt)]);

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "restrict" }),
  participantName: text("participant_name").notNull(),
  participantPhoneEncrypted: text("participant_phone_encrypted"),
  participantPhoneHash: text("participant_phone_hash"),
  participantEmailEncrypted: text("participant_email_encrypted"),
  participantEmailHash: text("participant_email_hash"),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  imageKey: text("image_key"),
  tile: text("tile").notNull(),
  glyph: text("glyph").notNull().default("ಹೊ"),
  state: submissionStateEnum("state").notNull().default("VISIBLE"),
  paidVoteCount: integer("paid_vote_count").notNull().default(0),
  showcaseVoteCount: integer("showcase_vote_count").notNull().default(0),
  lastVoteReachedAt: timestamp("last_vote_reached_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("submission_vote_counts_nonnegative", sql`${t.paidVoteCount} >= 0 and ${t.showcaseVoteCount} >= 0`), index("submissions_competition_idx").on(t.competitionId, t.state), index("submissions_phone_idx").on(t.competitionId, t.participantPhoneHash), index("submissions_email_idx").on(t.competitionId, t.participantEmailHash)]);

export const entryIdentityCounters = pgTable("entry_identity_counters", {
  competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "restrict" }),
  identityHash: text("identity_hash").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("entry_identity_unique").on(t.competitionId, t.identityHash), check("entry_identity_count_nonnegative", sql`${t.count} >= 0`)]);

export const voteOrders = pgTable("vote_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "restrict" }),
  clientRequestId: uuid("client_request_id").notNull().unique(),
  statusToken: uuid("status_token").notNull().defaultRandom().unique(),
  merchantOrderId: text("merchant_order_id").notNull().unique(),
  phonepeOrderId: text("phonepe_order_id").unique(),
  voterNameEncrypted: text("voter_name_encrypted").notNull(),
  voterPhoneEncrypted: text("voter_phone_encrypted").notNull(),
  voterPhoneHash: text("voter_phone_hash").notNull(),
  amountPaise: integer("amount_paise").notNull().default(200),
  currency: text("currency").notNull().default("INR"),
  state: paymentStateEnum("state").notNull().default("CREATED"),
  checkoutUrl: text("checkout_url"),
  failureCode: text("failure_code"),
  workflowRunId: text("workflow_run_id"),
  refundId: text("refund_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  creditedAt: timestamp("credited_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("vote_amount_fixed", sql`${t.amountPaise} = 200`), check("vote_currency_inr", sql`${t.currency} = 'INR'`), uniqueIndex("vote_orders_unresolved_phone_unique").on(t.voterPhoneHash).where(sql`${t.state} in ('CREATED', 'PENDING')`), index("vote_orders_competition_idx").on(t.competitionId, t.state), index("vote_orders_phone_idx").on(t.voterPhoneHash, t.state)]);

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  voteOrderId: uuid("vote_order_id").references(() => voteOrders.id, { onDelete: "restrict" }),
  providerEventKey: text("provider_event_key").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const competitionWinners = pgTable("competition_winners", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "restrict" }),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  rank: integer("rank").notNull(),
  voteCountSnapshot: integer("vote_count_snapshot").notNull(),
  tieBreakAt: timestamp("tie_break_at", { withTimezone: true }).notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("competition_rank_unique").on(t.competitionId, t.rank), uniqueIndex("competition_submission_unique").on(t.competitionId, t.submissionId), check("winner_rank_range", sql`${t.rank} between 1 and 3`)]);

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
