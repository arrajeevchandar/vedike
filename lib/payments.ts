import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "@/db";
import { competitions, paymentEvents, submissions, voteOrders } from "@/db/schema";
import { getPhonePeOrderStatus, refundPhonePeOrder } from "@/lib/phonepe";
import { redactProviderPayload } from "@/lib/security";
import { VOTE_PRICE_PAISE } from "@/lib/domain";

export async function creditCompletedOrder(merchantOrderId: string, provider: { orderId: string; state: string; amount: number; errorCode?: string; completedAt?: Date }, rawEvent?: Record<string, unknown>) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(voteOrders).where(eq(voteOrders.merchantOrderId, merchantOrderId)).limit(1);
    if (!order) throw new Error("Unknown merchant order.");
    if (provider.amount !== VOTE_PRICE_PAISE || provider.orderId !== order.phonepeOrderId) throw new Error("PhonePe order validation failed.");
    if (rawEvent) {
      const key = createHash("sha256").update(JSON.stringify(rawEvent)).digest("hex");
      await tx.insert(paymentEvents).values({ voteOrderId: order.id, providerEventKey: key, eventType: String(rawEvent.event ?? rawEvent.type ?? "order.status"), payload: redactProviderPayload(rawEvent) }).onConflictDoNothing();
    }
    if (provider.state !== "COMPLETED") {
      const state = provider.state === "FAILED" ? "FAILED" : "PENDING";
      await tx.update(voteOrders).set({ state, failureCode: provider.errorCode, updatedAt: new Date() }).where(eq(voteOrders.id, order.id));
      return { credited: false, state };
    }
    if (order.creditedAt) return { credited: false, state: "COMPLETED" as const };
    const [competition] = await tx.select().from(competitions).where(eq(competitions.id, order.competitionId)).limit(1);
    if (!competition) throw new Error("Competition missing.");
    if (competition.lifecycle === "COMPLETED") {
      const refundId = `R-${order.merchantOrderId}`.slice(0, 63);
      await tx.update(voteOrders).set({ state: "REFUND_PENDING", refundId, updatedAt: new Date() }).where(eq(voteOrders.id, order.id));
      return { credited: false, state: "REFUND_PENDING" as const, refundId };
    }
    const paidAt = provider.completedAt ?? new Date();
    await tx.update(voteOrders).set({ state: "COMPLETED", paidAt, creditedAt: new Date(), updatedAt: new Date() }).where(and(eq(voteOrders.id, order.id), isNull(voteOrders.creditedAt)));
    await tx.update(submissions).set({ paidVoteCount: sql`${submissions.paidVoteCount} + 1`, lastVoteReachedAt: paidAt, updatedAt: new Date() }).where(eq(submissions.id, order.submissionId));
    return { credited: true, state: "COMPLETED" as const };
  });
}

export async function reconcileOrder(orderId: string) {
  const db = getDb();
  const [order] = await db.select().from(voteOrders).where(eq(voteOrders.id, orderId)).limit(1);
  if (!order || !["CREATED", "PENDING"].includes(order.state)) return order?.state ?? "MISSING";
  const status = await getPhonePeOrderStatus(order.merchantOrderId);
  const result = await creditCompletedOrder(order.merchantOrderId, { orderId: status.orderId, state: status.state, amount: status.amount, errorCode: status.errorCode });
  if (result.state === "REFUND_PENDING" && result.refundId) await refundPhonePeOrder(order.merchantOrderId, result.refundId);
  return result.state;
}
