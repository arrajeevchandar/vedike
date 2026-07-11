import { and, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { start } from "workflow/api";
import { getDb, hasDatabase } from "@/db";
import { competitions, events, submissions, voteOrders } from "@/db/schema";
import {
  deriveStatus,
  normalizeIndianPhone,
  VOTE_PRICE_PAISE,
} from "@/lib/domain";
import { createPhonePeOrder, hasPhonePeConfig } from "@/lib/phonepe";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, encryptPii, hashIdentity } from "@/lib/security";
import { voteOrderSchema } from "@/lib/validation";
import { reconcilePaymentWorkflow } from "@/workflows/reconcile-payment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!hasDatabase() || !hasPhonePeConfig()) {
      return Response.json(
        {
          error:
            "PhonePe sandbox and database credentials must be configured first.",
        },
        { status: 503 },
      );
    }

    await assertTrustedOrigin();
    const parsed = voteOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid vote." },
        { status: 400 },
      );
    }

    const phone = normalizeIndianPhone(parsed.data.voterPhone);
    const phoneHash = hashIdentity(`voter:${phone}`);
    const ip =
      (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const [ipLimit, phoneLimit] = await Promise.all([
      checkRateLimit("vote-ip", ip, 15, "1 m"),
      checkRateLimit("vote-phone", phoneHash, 8, "1 m"),
    ]);
    if (!ipLimit.success || !phoneLimit.success) {
      return Response.json(
        { error: "Please complete votes one at a time." },
        { status: 429 },
      );
    }

    const db = getDb();
    const local = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${phoneHash}, 0))`,
      );

      const [idempotent] = await tx
        .select()
        .from(voteOrders)
        .where(eq(voteOrders.clientRequestId, parsed.data.idempotencyKey))
        .limit(1);
      if (idempotent) {
        if (
          idempotent.voterPhoneHash !== phoneHash ||
          idempotent.submissionId !== parsed.data.submissionId
        ) {
          throw new Error("IDEMPOTENCY_MISMATCH");
        }
        return { kind: "existing" as const, order: idempotent };
      }

      const [eligible] = await tx
        .select({ submission: submissions, competition: competitions, event: events })
        .from(submissions)
        .innerJoin(
          competitions,
          eq(submissions.competitionId, competitions.id),
        )
        .innerJoin(events, eq(competitions.eventId, events.id))
        .where(eq(submissions.id, parsed.data.submissionId))
        .limit(1);
      if (
        !eligible ||
        eligible.event.publicationState !== "PUBLISHED" ||
        eligible.submission.state !== "VISIBLE" ||
        eligible.competition.isShowcase ||
        eligible.competition.lifecycle !== "PUBLISHED" ||
        deriveStatus(eligible.competition) !== "live"
      ) {
        throw new Error("VOTING_CLOSED");
      }

      const [active] = await tx
        .select({ id: voteOrders.id })
        .from(voteOrders)
        .where(
          and(
            eq(voteOrders.voterPhoneHash, phoneHash),
            inArray(voteOrders.state, ["CREATED", "PENDING"]),
          ),
        )
        .limit(1);
      if (active) throw new Error("ACTIVE_ORDER");

      const orderId = crypto.randomUUID();
      const merchantOrderId = `VDK-${orderId.replaceAll("-", "")}`.slice(0, 63);
      const [order] = await tx
        .insert(voteOrders)
        .values({
          id: orderId,
          submissionId: eligible.submission.id,
          competitionId: eligible.competition.id,
          clientRequestId: parsed.data.idempotencyKey,
          merchantOrderId,
          voterNameEncrypted: encryptPii(parsed.data.voterName),
          voterPhoneEncrypted: encryptPii(phone),
          voterPhoneHash: phoneHash,
          amountPaise: VOTE_PRICE_PAISE,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        })
        .returning();
      return {
        kind: "created" as const,
        order,
        competitionSlug: eligible.competition.slug,
      };
    });

    if (local.kind === "existing") {
      if (local.order.checkoutUrl) {
        return Response.json({
          redirectUrl: local.order.checkoutUrl,
          statusToken: local.order.statusToken,
          state: local.order.state,
        });
      }
      if (["CREATED", "PENDING"].includes(local.order.state)) {
        return Response.json(
          {
            statusToken: local.order.statusToken,
            state: local.order.state,
            error: "Checkout is still being prepared. Retry shortly.",
          },
          { status: 202 },
        );
      }
      return Response.json(
        {
          statusToken: local.order.statusToken,
          state: local.order.state,
          error: "This request has already reached a terminal state.",
        },
        { status: 409 },
      );
    }

    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    let phonePe: Awaited<ReturnType<typeof createPhonePeOrder>>;
    try {
      phonePe = await createPhonePeOrder({
        merchantOrderId: local.order.merchantOrderId,
        redirectUrl: `${appUrl}/competitions/${local.competitionSlug}?payment=${local.order.statusToken}`,
        voterPhone: phone,
      });
    } catch (error) {
      console.error("[phonepe-initiation]", error);
      await db
        .update(voteOrders)
        .set({
          state: "PENDING",
          failureCode: "INITIATION_UNCERTAIN",
          updatedAt: new Date(),
        })
        .where(eq(voteOrders.id, local.order.id));
      try {
        const run = await start(reconcilePaymentWorkflow, [local.order.id]);
        await db
          .update(voteOrders)
          .set({ workflowRunId: run.runId })
          .where(eq(voteOrders.id, local.order.id));
      } catch (workflowError) {
        console.error("[phonepe-workflow-start]", workflowError);
      }
      return Response.json(
        {
          error:
            "PhonePe did not confirm checkout creation. This order is being reconciled; please do not start another vote yet.",
          statusToken: local.order.statusToken,
        },
        { status: 502 },
      );
    }

    await db
      .update(voteOrders)
      .set({
        phonepeOrderId: phonePe.orderId,
        checkoutUrl: phonePe.redirectUrl,
        state: "PENDING",
        failureCode: null,
        expiresAt: new Date(phonePe.expireAt * 1000),
        updatedAt: new Date(),
      })
      .where(eq(voteOrders.id, local.order.id));

    try {
      const run = await start(reconcilePaymentWorkflow, [local.order.id]);
      await db
        .update(voteOrders)
        .set({ workflowRunId: run.runId })
        .where(eq(voteOrders.id, local.order.id));
    } catch (workflowError) {
      console.error("[phonepe-workflow-start]", workflowError);
      await db
        .update(voteOrders)
        .set({
          failureCode: "WORKFLOW_START_FAILED",
          updatedAt: new Date(),
        })
        .where(eq(voteOrders.id, local.order.id));
    }

    return Response.json(
      {
        redirectUrl: phonePe.redirectUrl,
        statusToken: local.order.statusToken,
        state: "PENDING",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[phonepe-order]", error);
    const code = error instanceof Error ? error.message : "";
    if (code === "VOTING_CLOSED") {
      return Response.json(
        { error: "Voting is closed for this entry." },
        { status: 409 },
      );
    }
    if (code === "ACTIVE_ORDER") {
      return Response.json(
        { error: "Finish your current vote before starting another." },
        { status: 409 },
      );
    }
    if (code === "IDEMPOTENCY_MISMATCH") {
      return Response.json(
        { error: "That payment request key was already used." },
        { status: 409 },
      );
    }
    if (code === "Untrusted request origin.") {
      return Response.json({ error: "Untrusted request origin." }, { status: 403 });
    }
    return Response.json(
      { error: "Checkout could not be created." },
      { status: 500 },
    );
  }
}