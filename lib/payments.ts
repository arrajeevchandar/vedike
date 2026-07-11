import "server-only";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "@/db";
import { competitions, paymentEvents, submissions, voteOrders } from "@/db/schema";
import {
  getPhonePeOrderStatus,
  getPhonePeRefundStatus,
  refundPhonePeOrder,
} from "@/lib/phonepe";
import { redactProviderPayload } from "@/lib/security";
import { VOTE_PRICE_PAISE } from "@/lib/domain";

type ProviderOrder = {
  orderId: string;
  state: string;
  amount: number;
  merchantId?: string;
  merchantOrderId?: string;
  errorCode?: string;
  completedAt?: Date;
};

function assertProviderIdentity(
  merchantOrderId: string,
  order: typeof voteOrders.$inferSelect,
  provider: ProviderOrder,
) {
  if (order.currency !== "INR" || provider.amount !== VOTE_PRICE_PAISE) {
    throw new Error("PhonePe amount or currency validation failed.");
  }
  if (provider.merchantOrderId && provider.merchantOrderId !== merchantOrderId) {
    throw new Error("PhonePe merchant order validation failed.");
  }
  if (
    provider.merchantId &&
    provider.merchantId !== process.env.PHONEPE_MERCHANT_ID
  ) {
    throw new Error("PhonePe merchant validation failed.");
  }
  if (order.phonepeOrderId && provider.orderId !== order.phonepeOrderId) {
    throw new Error("PhonePe order validation failed.");
  }
}

export async function creditCompletedOrder(
  merchantOrderId: string,
  provider: ProviderOrder,
  rawEvent?: Record<string, unknown>,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(voteOrders)
      .where(eq(voteOrders.merchantOrderId, merchantOrderId))
      .limit(1);
    if (!order) throw new Error("Unknown merchant order.");
    assertProviderIdentity(merchantOrderId, order, provider);

    if (rawEvent) {
      const key = createHash("sha256")
        .update(JSON.stringify(rawEvent))
        .digest("hex");
      await tx
        .insert(paymentEvents)
        .values({
          voteOrderId: order.id,
          providerEventKey: key,
          eventType: String(rawEvent.event ?? rawEvent.type ?? "order.status"),
          payload: redactProviderPayload(rawEvent),
        })
        .onConflictDoNothing();
    }

    if (provider.state !== "COMPLETED") {
      if (!["CREATED", "PENDING"].includes(order.state)) {
        return { credited: false, state: order.state };
      }
      const state = provider.state === "FAILED" ? "FAILED" : "PENDING";
      const [updated] = await tx
        .update(voteOrders)
        .set({
          state,
          phonepeOrderId: order.phonepeOrderId ?? provider.orderId,
          failureCode: provider.errorCode ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(voteOrders.id, order.id),
            inArray(voteOrders.state, ["CREATED", "PENDING"]),
          ),
        )
        .returning({ state: voteOrders.state });
      return { credited: false, state: updated?.state ?? order.state };
    }

    if (order.creditedAt) {
      return { credited: false, state: "COMPLETED" as const };
    }
    if (order.state === "REFUND_PENDING" && order.refundId) {
      return {
        credited: false,
        state: "REFUND_PENDING" as const,
        refundId: order.refundId,
      };
    }
    // Winner finalization uses the same lock. A payment is either credited
    // before the podium snapshot or converted into a refund after it.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${order.competitionId}, 0))`,
    );
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, order.competitionId))
      .limit(1);
    if (!competition) throw new Error("Competition missing.");
    const [submission] = await tx
      .select({ state: submissions.state })
      .from(submissions)
      .where(eq(submissions.id, order.submissionId))
      .limit(1);
    if (!submission) throw new Error("Submission missing.");

    if (
      competition.lifecycle === "COMPLETED" ||
      submission.state === "DISQUALIFIED"
    ) {
      const refundId = order.refundId ?? `R-${order.merchantOrderId}`.slice(0, 63);
      const [claimed] = await tx
        .update(voteOrders)
        .set({
          state: "REFUND_PENDING",
          phonepeOrderId: order.phonepeOrderId ?? provider.orderId,
          paidAt: provider.completedAt ?? new Date(),
          refundId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(voteOrders.id, order.id),
            isNull(voteOrders.creditedAt),
            inArray(voteOrders.state, ["CREATED", "PENDING"]),
          ),
        )
        .returning({ refundId: voteOrders.refundId });
      return claimed
        ? { credited: false, state: "REFUND_PENDING" as const, refundId }
        : { credited: false, state: order.state };
    }

    const paidAt = provider.completedAt ?? new Date();
    // This conditional update is the single vote-credit claim. Only its winner
    // is allowed to increment the cached submission count.
    const [claimed] = await tx
      .update(voteOrders)
      .set({
        state: "COMPLETED",
        phonepeOrderId: order.phonepeOrderId ?? provider.orderId,
        paidAt,
        creditedAt: new Date(),
        failureCode: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(voteOrders.id, order.id),
          isNull(voteOrders.creditedAt),
          inArray(voteOrders.state, ["CREATED", "PENDING"]),
        ),
      )
      .returning({ id: voteOrders.id });
    if (!claimed) {
      const [current] = await tx
        .select({ state: voteOrders.state })
        .from(voteOrders)
        .where(eq(voteOrders.id, order.id))
        .limit(1);
      return { credited: false, state: current?.state ?? order.state };
    }

    await tx
      .update(submissions)
      .set({
        paidVoteCount: sql`${submissions.paidVoteCount} + 1`,
        lastVoteReachedAt: paidAt,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, order.submissionId));
    return { credited: true, state: "COMPLETED" as const };
  });
}

export async function reconcileOrder(orderId: string) {
  const db = getDb();
  const [order] = await db
    .select()
    .from(voteOrders)
    .where(eq(voteOrders.id, orderId))
    .limit(1);
  if (!order) return "MISSING";

  if (order.state === "REFUND_PENDING") {
    if (!order.refundId) {
      await db
        .update(voteOrders)
        .set({ state: "REVIEW_REQUIRED", updatedAt: new Date() })
        .where(eq(voteOrders.id, order.id));
      return "REVIEW_REQUIRED";
    }
    let status: Awaited<ReturnType<typeof getPhonePeRefundStatus>>;
    try {
      status = await getPhonePeRefundStatus(order.refundId);
    } catch {
      // A status lookup can arrive before the original refund request was
      // accepted. Re-issuing the same merchant refund ID is idempotent.
      await refundPhonePeOrder(order.merchantOrderId, order.refundId);
      return "REFUND_PENDING";
    }
    if (
      status.amount !== VOTE_PRICE_PAISE ||
      status.originalMerchantOrderId !== order.merchantOrderId ||
      status.merchantRefundId !== order.refundId ||
      status.merchantId !== process.env.PHONEPE_MERCHANT_ID
    ) {
      throw new Error("PhonePe refund validation failed.");
    }
    if (status.state === "COMPLETED") {
      await db
        .update(voteOrders)
        .set({ state: "REFUNDED", refundedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(voteOrders.id, order.id), eq(voteOrders.state, "REFUND_PENDING")));
      return "REFUNDED";
    }
    if (status.state === "FAILED") {
      await db
        .update(voteOrders)
        .set({ state: "REVIEW_REQUIRED", updatedAt: new Date() })
        .where(and(eq(voteOrders.id, order.id), eq(voteOrders.state, "REFUND_PENDING")));
      return "REVIEW_REQUIRED";
    }
    // The refund endpoint is idempotent for merchant refund IDs. Retrying here
    // repairs an order if the first request failed before PhonePe acknowledged it.
    await refundPhonePeOrder(order.merchantOrderId, order.refundId);
    return "REFUND_PENDING";
  }

  if (!["CREATED", "PENDING"].includes(order.state)) return order.state;
  const status = await getPhonePeOrderStatus(order.merchantOrderId);
  const result = await creditCompletedOrder(order.merchantOrderId, {
    orderId: status.orderId,
    state: status.state,
    amount: status.amount,
    merchantId: status.merchantId,
    merchantOrderId: status.merchantOrderId,
    errorCode: status.errorCode,
  });
  if (result.state === "REFUND_PENDING" && result.refundId) {
    await refundPhonePeOrder(order.merchantOrderId, result.refundId);
  }
  return result.state;
}

export async function expireOrderIfDue(orderId: string) {
  const db = getDb();
  await db
    .update(voteOrders)
    .set({ state: "EXPIRED", updatedAt: new Date() })
    .where(
      and(
        eq(voteOrders.id, orderId),
        inArray(voteOrders.state, ["CREATED", "PENDING"]),
        lte(voteOrders.expiresAt, new Date()),
      ),
    );
  const [order] = await db
    .select({ state: voteOrders.state })
    .from(voteOrders)
    .where(eq(voteOrders.id, orderId))
    .limit(1);
  return order?.state ?? "MISSING";
}
