import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { voteOrders } from "@/db/schema";
import { reconcileOrder } from "@/lib/payments";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ statusToken: string }> },
) {
  if (!hasDatabase()) {
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  const { statusToken } = await params;
  const db = getDb();
  let [order] = await db
    .select({
      id: voteOrders.id,
      state: voteOrders.state,
      creditedAt: voteOrders.creditedAt,
      updatedAt: voteOrders.updatedAt,
    })
    .from(voteOrders)
    .where(eq(voteOrders.statusToken, statusToken))
    .limit(1);
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });

  if (
    ["CREATED", "PENDING", "REFUND_PENDING"].includes(order.state) &&
    Date.now() - order.updatedAt.getTime() > 5_000
  ) {
    await reconcileOrder(order.id).catch((error) =>
      console.error("[phonepe-status-reconcile]", error),
    );
    [order] = await db
      .select({
        id: voteOrders.id,
        state: voteOrders.state,
        creditedAt: voteOrders.creditedAt,
        updatedAt: voteOrders.updatedAt,
      })
      .from(voteOrders)
      .where(eq(voteOrders.statusToken, statusToken))
      .limit(1);
  }
  return Response.json(order, { headers: { "Cache-Control": "no-store" } });
}
