import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { voteOrders } from "@/db/schema";
import {
  refundPhonePeOrder,
  validatePhonePeCallback,
} from "@/lib/phonepe";
import { creditCompletedOrder } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const authorization = request.headers.get("authorization") ?? "";
  let callback: ReturnType<typeof validatePhonePeCallback>;
  try {
    callback = validatePhonePeCallback(authorization, body);
  } catch (error) {
    console.warn("[phonepe-webhook] callback authentication failed", error);
    return Response.json({ error: "Invalid callback" }, { status: 401 });
  }

  try {
    const payload = callback.payload;
    if (payload.merchantRefundId && payload.originalMerchantOrderId) {
      if (
        payload.amount !== 200 ||
        payload.merchantId !== process.env.PHONEPE_MERCHANT_ID
      ) {
        throw new Error("PhonePe refund callback validation failed.");
      }
      const db = getDb();
      const [order] = await db
        .select({ id: voteOrders.id, refundId: voteOrders.refundId })
        .from(voteOrders)
        .where(eq(voteOrders.merchantOrderId, payload.originalMerchantOrderId))
        .limit(1);
      if (!order || order.refundId !== payload.merchantRefundId) {
        throw new Error("Unknown PhonePe refund callback.");
      }
      if (payload.state === "COMPLETED") {
        await db
          .update(voteOrders)
          .set({ state: "REFUNDED", refundedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(voteOrders.id, order.id),
              inArray(voteOrders.state, ["REFUND_PENDING", "REFUNDED"]),
            ),
          );
      } else if (payload.state === "FAILED") {
        await db
          .update(voteOrders)
          .set({ state: "REVIEW_REQUIRED", updatedAt: new Date() })
          .where(
            and(
              eq(voteOrders.id, order.id),
              eq(voteOrders.state, "REFUND_PENDING"),
            ),
          );
      }
      return Response.json({ ok: true });
    }

    if (!payload.merchantOrderId) return Response.json({ ok: true });
    const result = await creditCompletedOrder(
      payload.merchantOrderId,
      {
        orderId: payload.orderId,
        state: payload.state,
        amount: payload.amount,
        merchantId: payload.merchantId,
        merchantOrderId: payload.merchantOrderId,
        errorCode: payload.errorCode,
      },
      JSON.parse(body) as Record<string, unknown>,
    );
    if (result.state === "REFUND_PENDING" && result.refundId) {
      await refundPhonePeOrder(payload.merchantOrderId, result.refundId);
    }
    return Response.json({ ok: true });
  } catch (error) {
    // Authentication failures have already returned 401. A 5xx here tells
    // PhonePe to retry verified callbacks that hit a transient dependency.
    console.error("[phonepe-webhook] processing failed", error);
    return Response.json({ error: "Callback processing failed" }, { status: 500 });
  }
}
