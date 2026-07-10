import { sleep } from "workflow";

export async function reconcilePaymentWorkflow(orderId: string) {
  "use workflow";
  const schedule = [22_000, ...Array(10).fill(3_000), ...Array(10).fill(6_000), ...Array(6).fill(10_000), ...Array(2).fill(30_000), ...Array(10).fill(60_000)];
  for (const delay of schedule) {
    await sleep(delay);
    const state = await reconcileStep(orderId);
    if (!["CREATED", "PENDING"].includes(state)) return state;
  }
  return expireStep(orderId);
}

async function reconcileStep(orderId: string) {
  "use step";
  console.log(`[reconcilePayment] START orderId=${orderId}`);
  const { reconcileOrder } = await import("@/lib/payments");
  const state = await reconcileOrder(orderId);
  console.log(`[reconcilePayment] DONE orderId=${orderId} state=${state}`);
  return state;
}

async function expireStep(orderId: string) {
  "use step";
  const { getDb } = await import("@/db");
  const { voteOrders } = await import("@/db/schema");
  const { eq, and, inArray } = await import("drizzle-orm");
  await getDb().update(voteOrders).set({ state: "EXPIRED", updatedAt: new Date() }).where(and(eq(voteOrders.id, orderId), inArray(voteOrders.state, ["CREATED", "PENDING"])));
  return "EXPIRED";
}
