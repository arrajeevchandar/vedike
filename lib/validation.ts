import { z } from "zod";

const phone = z.string().trim().min(10).max(18);
const title = z.string().trim().min(3).max(120);
const description = z.string().trim().min(1).max(5000);

export const submissionSchema = z.object({
  competitionId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  phone,
  email: z.email().max(254),
  description: z.string().trim().min(3).max(2000),
});

export const voteOrderSchema = z.object({
  submissionId: z.string().uuid(),
  voterName: z.string().trim().min(2).max(100),
  voterPhone: phone,
  idempotencyKey: z.string().uuid(),
});

export const eventSchema = z.object({
  id: z.string().uuid().optional(),
  title,
  description,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  publicationState: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("PUBLISHED"),
}).refine((v) => v.startsAt < v.endsAt, { message: "End time must be after start time." });

export const competitionSchema = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  title,
  description,
  rules: z.string().max(5000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  maxEntriesPerParticipant: z.union([z.coerce.number().int().positive().max(100), z.literal("")]).optional(),
}).refine((v) => v.startsAt < v.endsAt, { message: "End time must be after start time." });
