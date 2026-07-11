import { sleep } from "workflow";

export async function reconcilePaymentWorkflow(orderId: string) {
  "use workflow";
  // PhonePe Checkout is valid for 15 minutes. The durable workflow keeps
  // reconciling past that boundary, including delayed refund confirmation.
  const schedule = [
    22_000,
    ...Array(10).fill(3_000),
    ...Array(10).fill(6_000),
    ...Array(6).fill(10_000),
    ...Array(2).fill(30_000),
    ...Array(12).fill(60_000),
  ];
  for (const delay of schedule) {
    await sleep(delay);
    const state = await reconcileStep(orderId);
    if (!["CREATED", "PENDING", "REFUND_PENDING"].includes(state)) return state;
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
  const { expireOrderIfDue } = await import("@/lib/payments");
  return expireOrderIfDue(orderId);
}
