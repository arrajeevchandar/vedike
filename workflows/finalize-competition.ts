import { sleep } from "workflow";

export async function finalizeCompetitionWorkflow(competitionId: string) {
  "use workflow";
  // Allow the full PhonePe checkout window plus a settlement buffer before
  // asking an administrator to review a stuck payment/refund.
  for (let attempt = 0; attempt < 44; attempt += 1) {
    const pending = await reconcilePendingStep(competitionId);
    if (pending === 0) return snapshotWinnersStep(competitionId);
    await sleep(attempt < 6 ? "10s" : "30s");
  }
  return markReviewStep(competitionId);
}

async function reconcilePendingStep(competitionId: string) {
  "use step";
  const { getDb } = await import("@/db");
  const { voteOrders } = await import("@/db/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const db = getDb();
  const rows = await db
    .select({ id: voteOrders.id })
    .from(voteOrders)
    .where(
      and(
        eq(voteOrders.competitionId, competitionId),
        inArray(voteOrders.state, ["CREATED", "PENDING", "REFUND_PENDING"]),
      ),
    );
  const { reconcileOrder } = await import("@/lib/payments");
  await Promise.all(
    rows.map((row) =>
      reconcileOrder(row.id).catch((error) =>
        console.error(`[finalizeCompetition] reconcile ${row.id}`, error),
      ),
    ),
  );
  const remaining = await db
    .select({ id: voteOrders.id })
    .from(voteOrders)
    .where(
      and(
        eq(voteOrders.competitionId, competitionId),
        inArray(voteOrders.state, ["CREATED", "PENDING", "REFUND_PENDING"]),
      ),
    );
  return remaining.length;
}

async function snapshotWinnersStep(competitionId: string) {
  "use step";
  const { getDb } = await import("@/db");
  const { competitions, competitionWinners, submissions } = await import("@/db/schema");
  const { and, asc, desc, eq, sql } = await import("drizzle-orm");

  await getDb().transaction(async (tx) => {
    // Keep credits and finalization mutually exclusive at the competition level.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${competitionId}, 0))`,
    );
    const [competition] = await tx
      .select({ lifecycle: competitions.lifecycle })
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);
    if (!competition || competition.lifecycle === "COMPLETED") return;
    if (competition.lifecycle !== "CLOSING") {
      throw new Error("Competition is not in closing state.");
    }

    const rows = await tx
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.competitionId, competitionId),
          eq(submissions.state, "VISIBLE"),
        ),
      )
      .orderBy(
        desc(submissions.paidVoteCount),
        asc(sql`coalesce(${submissions.lastVoteReachedAt}, ${submissions.createdAt})`),
        asc(submissions.createdAt),
      )
      .limit(3);
    if (rows.length) {
      await tx
        .insert(competitionWinners)
        .values(
          rows.map((row, index) => ({
            competitionId,
            submissionId: row.id,
            rank: index + 1,
            voteCountSnapshot: row.paidVoteCount,
            tieBreakAt: row.lastVoteReachedAt ?? row.createdAt,
          })),
        )
        .onConflictDoNothing();
    }
    await tx
      .update(competitions)
      .set({ lifecycle: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(competitions.id, competitionId), eq(competitions.lifecycle, "CLOSING")));
  });
  return "COMPLETED";
}

async function markReviewStep(competitionId: string) {
  "use step";
  const { getDb } = await import("@/db");
  const { adminAuditLog } = await import("@/db/schema");
  await getDb().insert(adminAuditLog).values({
    action: "FINALIZATION_REVIEW_REQUIRED",
    entityType: "competition",
    entityId: competitionId,
    metadata: {
      reason: "Pending payments did not settle within the workflow window.",
    },
  });
  return "REVIEW_REQUIRED";
}
