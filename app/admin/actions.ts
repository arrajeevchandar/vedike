"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
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

function validationError(message: string): never {
  throw new Error(message);
}

export async function saveEventAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const parsed = eventSchema.safeParse({
    id: id || undefined,
    title: form.get("title"),
    description: form.get("description"),
    startsAt: istInputToUtc(String(form.get("startsAt") ?? "")),
    endsAt: istInputToUtc(String(form.get("endsAt") ?? "")),
  });
  if (!parsed.success) validationError(parsed.error.issues[0]?.message ?? "Invalid event.");
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
      if (
        children.some(
          (competition) =>
            competition.startsAt < parsed.data.startsAt ||
            competition.endsAt > parsed.data.endsAt,
        )
      ) {
        validationError("Event dates must still contain every active competition.");
      }
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

export async function saveCompetitionAction(form: FormData) {
  await requireAdmin();
  await assertTrustedOrigin();
  const id = String(form.get("id") ?? "");
  const rawLimit = String(form.get("maxEntries") ?? "1");
  const parsed = competitionSchema.safeParse({
    id: id || undefined,
    eventId: form.get("eventId"),
    title: form.get("title"),
    description: form.get("description"),
    rules: form.get("rules"),
    startsAt: istInputToUtc(String(form.get("startsAt") ?? "")),
    endsAt: istInputToUtc(String(form.get("endsAt") ?? "")),
    maxEntriesPerParticipant: rawLimit === "" ? "" : Number(rawLimit),
  });
  if (!parsed.success) {
    validationError(parsed.error.issues[0]?.message ?? "Invalid competition.");
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
  await db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(eq(events.id, parsed.data.eventId))
      .limit(1);
    if (
      !event ||
      event.isShowcase ||
      event.publicationState === "ARCHIVED" ||
      parsed.data.startsAt < event.startsAt ||
      parsed.data.endsAt > event.endsAt
    ) {
      validationError("Competition dates must be inside an active parent event.");
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
        existing.lifecycle !== "PUBLISHED"
      ) {
        validationError("Only published non-showcase competitions can be edited.");
      }
      await tx
        .update(competitions)
        .set({
          eventId: event.id,
          title: parsed.data.title,
          description: parsed.data.description,
          rules,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
          maxEntriesPerParticipant,
          updatedAt: new Date(),
        })
        .where(eq(competitions.id, existing.id));
      await tx.insert(adminAuditLog).values({
        action: "UPDATE_COMPETITION",
        entityType: "competition",
        entityId: existing.id,
      });
      return;
    }
    const [created] = await tx
      .insert(competitions)
      .values({
        eventId: event.id,
        slug: `${slugify(parsed.data.title)}-${Date.now().toString(36)}`,
        title: parsed.data.title,
        description: parsed.data.description,
        rules,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
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
  });
  revalidatePath("/events");
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/competitions");
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
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);
    if (
      !submission ||
      submission.showcaseVoteCount > 0 ||
      submission.state === "DISQUALIFIED"
    ) {
      validationError("This showcase submission cannot be moderated.");
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

export async function completeCompetitionAction(form: FormData) {
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
        eq(competitions.lifecycle, "PUBLISHED"),
        eq(competitions.isShowcase, false),
      ),
    )
    .returning({ id: competitions.id });
  if (!claimed) return;
  const run = await start(finalizeCompetitionWorkflow, [id]);
  await db.insert(adminAuditLog).values({
    action: "START_COMPETITION_FINALIZATION",
    entityType: "competition",
    entityId: id,
    metadata: { runId: run.runId },
  });
  revalidatePath("/competitions");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/leaderboard");
}
