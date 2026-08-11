"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { start } from "workflow/api";
import {
  clearAdminSession,
  createAdminSession,
  requireAdmin,
  verifyAdminCredentials,
} from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDb, hasDatabase } from "@/db";
import {
  adminAuditLog,
  competitions,
  events,
  submissions,
  voteOrders,
} from "@/db/schema";
import { istInputToUtc, slugify } from "@/lib/domain";
import { competitionSchema, eventSchema } from "@/lib/validation";
import { finalizeCompetitionWorkflow } from "@/workflows/finalize-competition";
import { reconcilePaymentWorkflow } from "@/workflows/reconcile-payment";
import { competitionPhaseWorkflow } from "@/workflows/competition-phase";
import { votingWindowOpen } from "@/lib/competition-phase";
import {
  type AdminFormState,
  type ScheduleField,
  utcToIstInput,
  validateCompetitionSchedule,
} from "@/lib/admin-schedule";

export type LoginState = { error?: string };

export async function loginAction(
  _: LoginState,
  form: FormData,
): Promise<LoginState> {
  await assertTrustedOrigin();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const limit = await checkRateLimit("admin-login", email.toLowerCase(), 5, "15 m");
  if (!limit.success) return { error: "Too many attempts. Try again later." };
  if (!(await verifyAdminCredentials(email, password))) {
    return { error: "Invalid admin credentials." };
  }
  await createAdminSession(email);
  redirect("/admin");
}

export async function logoutAction() {
  await requireAdmin();
  await assertTrustedOrigin();
  await clearAdminSession();
  redirect("/events");
}

function ensureDb() {
  if (!hasDatabase()) {
    throw new Error("Connect Neon and run migrations before using admin mutations.");
  }
  return getDb();
}

class AdminValidationError extends Error {
  constructor(message: string, readonly fieldErrors?: Partial<Record<ScheduleField, string>>) {
    super(message);
    this.name = "AdminValidationError";
  }
}

function validationError(message: string, fieldErrors?: Partial<Record<ScheduleField, string>>): never {
  throw new AdminValidationError(message, fieldErrors);
}

function readIstField(form: FormData, field: ScheduleField) {
  try {
    return istInputToUtc(String(form.get(field) ?? ""));
  } catch {
    validationError("Choose a valid date and time.", { [field]: "Choose a valid date and time." });
  }
}

function zodScheduleErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const fieldErrors: Partial<Record<ScheduleField, string>> = {};
  const scheduleFields = new Set<ScheduleField>(["startsAt", "endsAt", "applicationStartsAt", "applicationEndsAt", "votingStartsAt", "votingEndsAt"]);
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "") as ScheduleField;
    if (scheduleFields.has(field) && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

async function persistEvent(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const parsed = eventSchema.safeParse({
    id: id || undefined,
    title: form.get("title"),
    description: form.get("description"),
    startsAt: readIstField(form, "startsAt"),
    endsAt: readIstField(form, "endsAt"),
  });
  if (!parsed.success) validationError(parsed.error.issues[0]?.message ?? "Invalid event.", zodScheduleErrors(parsed.error.issues));
  const db = ensureDb();
  await db.transaction(async (tx) => {
    if (parsed.data.id) {
      const [existing] = await tx
        .select()
        .from(events)
        .where(eq(events.id, parsed.data.id))
        .limit(1);
      if (!existing || existing.isShowcase) validationError("This event cannot be edited.");
      const children = await tx
        .select({ startsAt: competitions.startsAt, endsAt: competitions.endsAt })
        .from(competitions)
        .where(
          and(
            eq(competitions.eventId, existing.id),
            ne(competitions.lifecycle, "ARCHIVED"),
          ),
        );
      const fieldErrors: Partial<Record<ScheduleField, string>> = {};
      if (children.some((competition) => competition.startsAt < parsed.data.startsAt)) {
        fieldErrors.startsAt = "Start cannot move beyond the earliest active competition.";
      }
      if (children.some((competition) => competition.endsAt > parsed.data.endsAt)) {
        fieldErrors.endsAt = "End cannot move before the latest active competition.";
      }
      if (Object.keys(fieldErrors).length) validationError("Event dates must still contain every active competition.", fieldErrors);
      await tx
        .update(events)
        .set({
          title: parsed.data.title,
          description: parsed.data.description,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
          updatedAt: new Date(),
        })
        .where(eq(events.id, existing.id));
      await tx.insert(adminAuditLog).values({
        action: "UPDATE_EVENT",
        entityType: "event",
        entityId: existing.id,
      });
      return;
    }
    const [created] = await tx
      .insert(events)
      .values({
        slug: `${slugify(parsed.data.title)}-${Date.now().toString(36)}`,
        title: parsed.data.title,
        description: parsed.data.description,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        glyph: "ಹೊ",
        banner: "linear-gradient(135deg,#3B0A12,#7a1622 55%,#b8341f)",
      })
      .returning({ id: events.id });
    await tx.insert(adminAuditLog).values({
      action: "CREATE_EVENT",
      entityType: "event",
      entityId: created.id,
    });
  });
  revalidatePath("/events");
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/events");
  return id ? "Event schedule updated." : "Event created.";
}

export async function saveEventAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  try {
    return { status: "success", message: await persistEvent(form) };
  } catch (error) {
    if (error instanceof AdminValidationError) return { status: "error", message: error.message, fieldErrors: error.fieldErrors };
    throw error;
  }
}

export async function archiveEventAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const db = ensureDb();
  await db.transaction(async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event || event.isShowcase) validationError("This event cannot be archived.");
    const childRows = await tx
      .select({ id: competitions.id })
      .from(competitions)
      .where(eq(competitions.eventId, id));
    if (childRows.length) {
      const [unresolved] = await tx
        .select({ id: voteOrders.id })
        .from(voteOrders)
        .where(
          and(
            inArray(
              voteOrders.competitionId,
              childRows.map((row) => row.id),
            ),
            inArray(voteOrders.state, ["CREATED", "PENDING", "REFUND_PENDING"]),
          ),
        )
        .limit(1);
      if (unresolved) validationError("Settle pending payments before archiving this event.");
    }
    await tx
      .update(events)
      .set({ publicationState: "ARCHIVED", updatedAt: new Date() })
      .where(eq(events.id, id));
    await tx.insert(adminAuditLog).values({
      action: "ARCHIVE_EVENT",
      entityType: "event",
      entityId: id,
    });
  });
  revalidatePath("/events");
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/events");
}

export async function completeEventAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const db = ensureDb();
  await db.transaction(async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event || event.isShowcase || event.publicationState === "ARCHIVED") {
      validationError("This event cannot be completed.");
    }
    if (event.publicationState === "COMPLETED") return;
    const [activeCompetition] = await tx
      .select({ id: competitions.id })
      .from(competitions)
      .where(
        and(
          eq(competitions.eventId, id),
          inArray(competitions.lifecycle, ["APPLICATIONS_OPEN", "VOTING_OPEN", "CLOSING"]),
        ),
      )
      .limit(1);
    if (activeCompetition) {
      validationError("Complete or archive every competition before completing this event.");
    }
    await tx
      .update(events)
      .set({ publicationState: "COMPLETED", updatedAt: new Date() })
      .where(eq(events.id, id));
    await tx.insert(adminAuditLog).values({
      action: "COMPLETE_EVENT",
      entityType: "event",
      entityId: id,
    });
  });
  revalidatePath("/events");
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/events");
  revalidatePath("/admin/competitions");
}

async function persistCompetition(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const rawLimit = String(form.get("maxEntries") ?? "1");
  const rawSchedule = {
    applicationStartsAt: String(form.get("applicationStartsAt") ?? ""),
    applicationEndsAt: String(form.get("applicationEndsAt") ?? ""),
    votingStartsAt: String(form.get("votingStartsAt") ?? ""),
    votingEndsAt: String(form.get("votingEndsAt") ?? ""),
  };
  const parsed = competitionSchema.safeParse({
    id: id || undefined,
    eventId: form.get("eventId"),
    title: form.get("title"),
    description: form.get("description"),
    rules: form.get("rules"),
    applicationStartsAt: readIstField(form, "applicationStartsAt"),
    applicationEndsAt: readIstField(form, "applicationEndsAt"),
    votingStartsAt: readIstField(form, "votingStartsAt"),
    votingEndsAt: readIstField(form, "votingEndsAt"),
    maxEntriesPerParticipant: rawLimit === "" ? "" : Number(rawLimit),
  });
  if (!parsed.success) {
    validationError(parsed.error.issues[0]?.message ?? "Invalid competition.", zodScheduleErrors(parsed.error.issues));
  }
  const maxEntriesPerParticipant =
    parsed.data.maxEntriesPerParticipant === ""
      ? null
      : parsed.data.maxEntriesPerParticipant ?? 1;
  const rules = parsed.data.rules
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  const db = ensureDb();
  const phaseSchedule = await db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(eq(events.id, parsed.data.eventId))
      .limit(1);
    if (!event || event.isShowcase || event.publicationState !== "PUBLISHED") {
      validationError("Choose an active published parent event.");
    }
    const scheduleErrors = validateCompetitionSchedule(rawSchedule, {
      startsAt: utcToIstInput(event.startsAt),
      endsAt: utcToIstInput(event.endsAt),
    });
    if (Object.keys(scheduleErrors).length) {
      validationError("Fix the highlighted schedule fields.", scheduleErrors);
    }
    if (parsed.data.id) {
      const [existing] = await tx
        .select()
        .from(competitions)
        .where(eq(competitions.id, parsed.data.id))
        .limit(1);
      if (
        !existing ||
        existing.isShowcase ||
        existing.lifecycle !== "APPLICATIONS_OPEN"
      ) {
        validationError("Only application-stage non-showcase competitions can be edited.");
      }
      await tx
        .update(competitions)
        .set({
          eventId: event.id,
          title: parsed.data.title,
          description: parsed.data.description,
          rules,
          startsAt: parsed.data.applicationStartsAt,
          endsAt: parsed.data.votingEndsAt,
          applicationStartsAt: parsed.data.applicationStartsAt,
          applicationEndsAt: parsed.data.applicationEndsAt,
          votingStartsAt: parsed.data.votingStartsAt,
          votingEndsAt: parsed.data.votingEndsAt,
          maxEntriesPerParticipant,
          updatedAt: new Date(),
        })
        .where(eq(competitions.id, existing.id));
      await tx.insert(adminAuditLog).values({
        action: "UPDATE_COMPETITION",
        entityType: "competition",
        entityId: existing.id,
      });
      return { id: existing.id, votingStartsAt: parsed.data.votingStartsAt, votingEndsAt: parsed.data.votingEndsAt };
    }
    const [created] = await tx
      .insert(competitions)
      .values({
        eventId: event.id,
        slug: `${slugify(parsed.data.title)}-${Date.now().toString(36)}`,
        title: parsed.data.title,
        description: parsed.data.description,
        rules,
        startsAt: parsed.data.applicationStartsAt,
        endsAt: parsed.data.votingEndsAt,
        applicationStartsAt: parsed.data.applicationStartsAt,
        applicationEndsAt: parsed.data.applicationEndsAt,
        votingStartsAt: parsed.data.votingStartsAt,
        votingEndsAt: parsed.data.votingEndsAt,
        lifecycle: "APPLICATIONS_OPEN",
        applicationsOpenedAt: new Date(),
        maxEntriesPerParticipant,
        glyph: "ಹೊ",
        banner: "linear-gradient(135deg,#241030,#4A1E5C 55%,#7a2f8f)",
      })
      .returning({ id: competitions.id });
    await tx.insert(adminAuditLog).values({
      action: "CREATE_COMPETITION",
      entityType: "competition",
      entityId: created.id,
    });
    return { id: created.id, votingStartsAt: parsed.data.votingStartsAt, votingEndsAt: parsed.data.votingEndsAt };
  });
  try {
    const run = await start(competitionPhaseWorkflow, [phaseSchedule.id, phaseSchedule.votingStartsAt.toISOString(), phaseSchedule.votingEndsAt.toISOString()]);
    await db.update(competitions).set({ phaseWorkflowRunId: run.runId, updatedAt: new Date() }).where(eq(competitions.id, phaseSchedule.id));
  } catch (error) {
    console.error("[competition-phase-workflow]", error);
  }
  revalidatePath("/events");
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/competitions");
  return id ? "Competition schedule updated." : "Competition created.";
}

export async function saveCompetitionAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  try {
    return { status: "success", message: await persistCompetition(form) };
  } catch (error) {
    if (error instanceof AdminValidationError) return { status: "error", message: error.message, fieldErrors: error.fieldErrors };
    throw error;
  }
}

export async function archiveCompetitionAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const db = ensureDb();
  await db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, id))
      .limit(1);
    if (!competition || competition.isShowcase) {
      validationError("This competition cannot be archived.");
    }
    const [unresolved] = await tx
      .select({ id: voteOrders.id })
      .from(voteOrders)
      .where(
        and(
          eq(voteOrders.competitionId, id),
          inArray(voteOrders.state, ["CREATED", "PENDING", "REFUND_PENDING"]),
        ),
      )
      .limit(1);
    if (unresolved) validationError("Settle pending payments before archiving.");
    await tx
      .update(competitions)
      .set({ lifecycle: "ARCHIVED", updatedAt: new Date() })
      .where(eq(competitions.id, id));
    await tx.insert(adminAuditLog).values({
      action: "ARCHIVE_COMPETITION",
      entityType: "competition",
      entityId: id,
    });
  });
  revalidatePath("/events");
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/competitions");
}

export async function moderateSubmissionAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const requestedState = String(form.get("state") ?? "");
  if (requestedState !== "VISIBLE" && requestedState !== "HIDDEN") {
    validationError("Invalid moderation state.");
  }
  const state: "VISIBLE" | "HIDDEN" = requestedState;
  const db = ensureDb();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ submission: submissions, competition: competitions })
      .from(submissions)
      .innerJoin(competitions, eq(submissions.competitionId, competitions.id))
      .where(eq(submissions.id, id))
      .limit(1);
    if (
      !row ||
      row.submission.showcaseVoteCount > 0 ||
      row.submission.state === "DISQUALIFIED" ||
      (state === "VISIBLE" && !votingWindowOpen(row.competition))
    ) {
      validationError("This entry cannot be made public outside its voting window.");
    }
    await tx
      .update(submissions)
      .set({ state, updatedAt: new Date() })
      .where(eq(submissions.id, id));
    await tx.insert(adminAuditLog).values({
      action: `SUBMISSION_${state}`,
      entityType: "submission",
      entityId: id,
    });
  });
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/submissions");
}

export async function approveSubmissionAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const db = ensureDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ submission: submissions, competition: competitions }).from(submissions).innerJoin(competitions, eq(submissions.competitionId, competitions.id)).where(eq(submissions.id, id)).limit(1);
    if (!row || row.submission.showcaseVoteCount > 0 || !["PENDING_REVIEW", "HIDDEN"].includes(row.submission.state) || !votingWindowOpen(row.competition)) {
      validationError("Only private entries can be released during live voting.");
    }
    await tx.update(submissions).set({ state: "VISIBLE", updatedAt: new Date() }).where(eq(submissions.id, id));
    await tx.insert(adminAuditLog).values({ action: "RELEASE_SUBMISSION_DURING_VOTING", entityType: "submission", entityId: id });
  });
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/submissions");
}

export async function disqualifySubmissionAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const db = ensureDb();
  const refundOrderIds = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ submission: submissions, competition: competitions })
      .from(submissions)
      .innerJoin(competitions, eq(submissions.competitionId, competitions.id))
      .where(eq(submissions.id, id))
      .limit(1);
    if (!row || row.submission.showcaseVoteCount > 0 || row.competition.isShowcase) {
      validationError("This showcase submission cannot be disqualified.");
    }
    if (row.competition.lifecycle === "COMPLETED") {
      validationError("A completed competition's podium is immutable; contact support for review.");
    }
    const settledOrders = await tx
      .select({ id: voteOrders.id, merchantOrderId: voteOrders.merchantOrderId })
      .from(voteOrders)
      .where(
        and(
          eq(voteOrders.submissionId, id),
          eq(voteOrders.state, "COMPLETED"),
        ),
      );
    await tx
      .update(submissions)
      .set({ state: "DISQUALIFIED", updatedAt: new Date() })
      .where(eq(submissions.id, id));
    for (const order of settledOrders) {
      await tx
        .update(voteOrders)
        .set({
          state: "REFUND_PENDING",
          refundId: `R-${order.merchantOrderId}`.slice(0, 63),
          updatedAt: new Date(),
        })
        .where(eq(voteOrders.id, order.id));
    }
    await tx.insert(adminAuditLog).values({
      action: "DISQUALIFY_SUBMISSION_REFUND_REQUESTED",
      entityType: "submission",
      entityId: id,
      metadata: { refundOrderCount: settledOrders.length },
    });
    return settledOrders.map((order) => order.id);
  });

  for (const orderId of refundOrderIds) {
    try {
      const run = await start(reconcilePaymentWorkflow, [orderId]);
      await db
        .update(voteOrders)
        .set({ workflowRunId: run.runId, updatedAt: new Date() })
        .where(eq(voteOrders.id, orderId));
    } catch (error) {
      console.error("[submission-disqualification-workflow]", error);
    }
  }
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/payments");
}

export async function deleteUnpaidSubmissionAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const db = ensureDb();
  const imageUrl = await db.transaction(async (tx) => {
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);
    if (
      !submission ||
      submission.showcaseVoteCount > 0 ||
      submission.paidVoteCount > 0
    ) {
      validationError("Only unpaid non-showcase submissions can be deleted.");
    }
    const [order] = await tx
      .select({ id: voteOrders.id })
      .from(voteOrders)
      .where(eq(voteOrders.submissionId, id))
      .limit(1);
    if (order) validationError("This submission has payment history and cannot be deleted.");
    await tx.delete(submissions).where(eq(submissions.id, id));
    await tx.insert(adminAuditLog).values({
      action: "DELETE_UNPAID_SUBMISSION",
      entityType: "submission",
      entityId: id,
    });
    return submission.imageUrl;
  });
  if (imageUrl) await del(imageUrl).catch((error) => console.error("[submission-blob-delete]", error));
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/submissions");
}

export async function closeVotingAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const db = ensureDb();
  const [claimed] = await db
    .update(competitions)
    .set({ lifecycle: "CLOSING", completionStartedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(competitions.id, id),
        eq(competitions.lifecycle, "VOTING_OPEN"),
        eq(competitions.isShowcase, false),
      ),
    )
    .returning({ id: competitions.id });
  if (!claimed) return;
  await db.insert(adminAuditLog).values({
    action: "CLOSE_VOTING_MANUALLY",
    entityType: "competition",
    entityId: id,
  });
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/leaderboard");
}

export async function publishCompetitionResultsAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const db = ensureDb();
  const [competition] = await db
    .select({ lifecycle: competitions.lifecycle, isShowcase: competitions.isShowcase })
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);
  if (competition?.lifecycle === "COMPLETED") {
    revalidatePath("/competitions");
    revalidatePath("/leaderboard");
    revalidatePath("/admin/competitions");
    revalidatePath("/admin/leaderboard");
    return;
  }
  if (!competition || competition.isShowcase || competition.lifecycle !== "CLOSING") {
    validationError("Only closed competitions can publish results.");
  }
  const run = await start(finalizeCompetitionWorkflow, [id]);
  await db
    .update(competitions)
    .set({ completionStartedAt: new Date(), updatedAt: new Date() })
    .where(eq(competitions.id, id));
  await db.insert(adminAuditLog).values({
    action: "PUBLISH_COMPETITION_RESULTS",
    entityType: "competition",
    entityId: id,
    metadata: { runId: run.runId },
  });
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/competitions");
  revalidatePath("/admin/leaderboard");
}

export async function openVotingAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const submissionIds = form.getAll("submissionIds").map(String).filter(Boolean);
  const db = ensureDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    const [competition] = await tx.select().from(competitions).where(eq(competitions.id, id)).limit(1);
    const now = new Date();
    if (!competition || competition.isShowcase || competition.lifecycle !== "APPLICATIONS_OPEN" || now < competition.applicationStartsAt || now >= competition.votingEndsAt) {
      validationError("This competition cannot open voting now.");
    }
    if (submissionIds.length) {
      const eligible = await tx.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.competitionId, id), eq(submissions.state, "PENDING_REVIEW"), inArray(submissions.id, submissionIds)));
      if (eligible.length !== submissionIds.length) validationError("Only pending entries from this competition can be released.");
      await tx.update(submissions).set({ state: "VISIBLE", updatedAt: now }).where(and(eq(submissions.competitionId, id), inArray(submissions.id, submissionIds), eq(submissions.state, "PENDING_REVIEW")));
    } else {
      const [visibleEntry] = await tx.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.competitionId, id), eq(submissions.state, "VISIBLE"))).limit(1);
      if (!visibleEntry) validationError("Release at least one entry before opening voting.");
    }
    await tx.update(competitions).set({ lifecycle: "VOTING_OPEN", votingOpenedAt: now, updatedAt: now }).where(and(eq(competitions.id, id), eq(competitions.lifecycle, "APPLICATIONS_OPEN")));
    await tx.insert(adminAuditLog).values({ action: "OPEN_VOTING_AND_RELEASE_ENTRIES", entityType: "competition", entityId: id, metadata: { releasedSubmissionCount: submissionIds.length, openedEarly: now < competition.votingStartsAt } });
  });
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/competitions");
  revalidatePath("/admin/submissions");
}
