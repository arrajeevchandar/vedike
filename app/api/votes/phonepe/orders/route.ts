import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { start } from "workflow/api";
import { getDb, hasDatabase } from "@/db";
import { competitions, submissions, voteOrders } from "@/db/schema";
import { deriveStatus, normalizeIndianPhone, VOTE_PRICE_PAISE } from "@/lib/domain";
import { createPhonePeOrder, hasPhonePeConfig } from "@/lib/phonepe";
import { checkRateLimit } from "@/lib/rate-limit";
import { encryptPii, hashIdentity } from "@/lib/security";
import { voteOrderSchema } from "@/lib/validation";
import { reconcilePaymentWorkflow } from "@/workflows/reconcile-payment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!hasDatabase() || !hasPhonePeConfig()) return Response.json({ error: "PhonePe sandbox and database credentials must be configured first." }, { status: 503 });
    const parsed = voteOrderSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid vote." }, { status: 400 });
    const phone = normalizeIndianPhone(parsed.data.voterPhone), phoneHash = hashIdentity(`voter:${phone}`);
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [ipLimit, phoneLimit] = await Promise.all([checkRateLimit("vote-ip", ip, 15, "1 m"), checkRateLimit("vote-phone", phoneHash, 8, "1 m")]);
    if (!ipLimit.success || !phoneLimit.success) return Response.json({ error: "Please complete votes one at a time." }, { status: 429 });
    const db = getDb();
    const [existing] = await db.select().from(voteOrders).where(eq(voteOrders.clientRequestId, parsed.data.idempotencyKey)).limit(1);
    if (existing?.checkoutUrl) return Response.json({ redirectUrl: existing.checkoutUrl, statusToken: existing.statusToken, state: existing.state });
    const [row] = await db.select({ submission: submissions, competition: competitions }).from(submissions).innerJoin(competitions, eq(submissions.competitionId, competitions.id)).where(eq(submissions.id, parsed.data.submissionId)).limit(1);
    if (!row || row.submission.state !== "VISIBLE" || row.competition.isShowcase || row.competition.lifecycle !== "PUBLISHED" || deriveStatus(row.competition) !== "live") return Response.json({ error: "Voting is closed for this entry." }, { status: 409 });
    const [active] = await db.select({ id: voteOrders.id }).from(voteOrders).where(and(eq(voteOrders.voterPhoneHash, phoneHash), inArray(voteOrders.state, ["CREATED", "PENDING"]))).limit(1);
    if (active) return Response.json({ error: "Finish your current vote before starting another." }, { status: 409 });
    const orderId = crypto.randomUUID(), merchantOrderId = `VDK-${orderId.replaceAll("-", "")}`.slice(0, 63), appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const [order] = await db.insert(voteOrders).values({ id: orderId, submissionId: row.submission.id, competitionId: row.competition.id, clientRequestId: parsed.data.idempotencyKey, merchantOrderId, voterNameEncrypted: encryptPii(parsed.data.voterName), voterPhoneEncrypted: encryptPii(phone), voterPhoneHash: phoneHash, amountPaise: VOTE_PRICE_PAISE, expiresAt: new Date(Date.now() + 15 * 60_000) }).returning();
    try {
      const phonePe = await createPhonePeOrder({ merchantOrderId, redirectUrl: `${appUrl}/competitions/${row.competition.slug}?payment=${order.statusToken}`, voterPhone: phone });
      await db.update(voteOrders).set({ phonepeOrderId: phonePe.orderId, checkoutUrl: phonePe.redirectUrl, state: "PENDING", expiresAt: new Date(phonePe.expireAt * 1000), updatedAt: new Date() }).where(eq(voteOrders.id, order.id));
      const run = await start(reconcilePaymentWorkflow, [order.id]);
      await db.update(voteOrders).set({ workflowRunId: run.runId }).where(eq(voteOrders.id, order.id));
      return Response.json({ redirectUrl: phonePe.redirectUrl, statusToken: order.statusToken, state: "PENDING" }, { status: 201 });
    } catch (error) { await db.update(voteOrders).set({ state: "FAILED", failureCode: "INITIATION_FAILED", updatedAt: new Date() }).where(eq(voteOrders.id, order.id)); throw error; }
  } catch (error) { console.error("[phonepe-order]", error); return Response.json({ error: error instanceof Error ? error.message : "Checkout could not be created." }, { status: 500 }); }
}
