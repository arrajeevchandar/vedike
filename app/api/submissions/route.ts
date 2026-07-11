import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { and, eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { getDb, hasDatabase } from "@/db";
import { competitions, entryIdentityCounters, events, submissions } from "@/db/schema";
import { deriveStatus, normalizeEmail, normalizeIndianPhone } from "@/lib/domain";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, encryptPii, hashIdentity } from "@/lib/security";
import { submissionSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_BYTES = 4_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    if (!hasDatabase()) {
      return Response.json(
        { error: "Database setup is required before accepting real submissions." },
        { status: 503 },
      );
    }

    await assertTrustedOrigin();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limited = await checkRateLimit("submission", ip, 5, "1 h");
    if (!limited.success) {
      return Response.json({ error: "Too many submissions. Please try later." }, { status: 429 });
    }

    const form = await request.formData();
    const parsed = submissionSchema.safeParse({
      competitionId: form.get("competitionId"),
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email"),
      description: form.get("description"),
    });
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid entry." },
        { status: 400 },
      );
    }

    const file = form.get("photo");
    if (
      !(file instanceof File) ||
      !ALLOWED_TYPES.has(file.type) ||
      file.size === 0 ||
      file.size > MAX_BYTES
    ) {
      return Response.json(
        { error: "Upload a JPEG, PNG or WebP image under 4 MB." },
        { status: 400 },
      );
    }

    const phone = normalizeIndianPhone(parsed.data.phone);
    const email = normalizeEmail(parsed.data.email);
    const phoneHash = hashIdentity(`phone:${phone}`);
    const emailHash = hashIdentity(`email:${email}`);
    const db = getDb();

    const [eligible] = await db
      .select({ competition: competitions, event: events })
      .from(competitions)
      .innerJoin(events, eq(competitions.eventId, events.id))
      .where(
        and(
          eq(competitions.id, parsed.data.competitionId),
          eq(events.publicationState, "PUBLISHED"),
        ),
      )
      .limit(1);
    if (
      !eligible ||
      eligible.competition.isShowcase ||
      eligible.competition.lifecycle !== "PUBLISHED" ||
      deriveStatus(eligible.competition) !== "live"
    ) {
      return Response.json(
        { error: "This competition is not accepting entries." },
        { status: 409 },
      );
    }

    const sanitized = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 86 })
      .toBuffer();
    const blob = await put(
      `submissions/${eligible.competition.id}/${randomUUID()}.webp`,
      sanitized,
      {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: true,
      },
    );

    try {
      const inserted = await db.transaction(async (tx) => {
        // Stable advisory-lock order serializes either-phone-or-email identity matches.
        for (const identityHash of [...new Set([phoneHash, emailHash])].sort()) {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${identityHash}, 0))`,
          );
        }

        const [current] = await tx
          .select({ competition: competitions, event: events })
          .from(competitions)
          .innerJoin(events, eq(competitions.eventId, events.id))
          .where(eq(competitions.id, parsed.data.competitionId))
          .limit(1);
        if (
          !current ||
          current.event.publicationState !== "PUBLISHED" ||
          current.competition.isShowcase ||
          current.competition.lifecycle !== "PUBLISHED" ||
          deriveStatus(current.competition) !== "live"
        ) {
          throw new Error("COMPETITION_CLOSED");
        }

        const existing = await tx
          .select()
          .from(entryIdentityCounters)
          .where(
            and(
              eq(entryIdentityCounters.competitionId, current.competition.id),
              inArray(entryIdentityCounters.identityHash, [phoneHash, emailHash]),
            ),
          );
        const limit = current.competition.maxEntriesPerParticipant;
        if (limit && existing.some((row) => row.count >= limit)) {
          throw new Error("ENTRY_LIMIT");
        }

        for (const identityHash of [phoneHash, emailHash]) {
          await tx
            .insert(entryIdentityCounters)
            .values({
              competitionId: current.competition.id,
              identityHash,
              count: 1,
            })
            .onConflictDoUpdate({
              target: [
                entryIdentityCounters.competitionId,
                entryIdentityCounters.identityHash,
              ],
              set: {
                count: sql`${entryIdentityCounters.count} + 1`,
                updatedAt: new Date(),
              },
            });
        }

        const [row] = await tx
          .insert(submissions)
          .values({
            competitionId: current.competition.id,
            participantName: parsed.data.name,
            participantPhoneEncrypted: encryptPii(phone),
            participantPhoneHash: phoneHash,
            participantEmailEncrypted: encryptPii(email),
            participantEmailHash: emailHash,
            description: parsed.data.description,
            imageUrl: blob.url,
            imageKey: blob.pathname,
            tile: "linear-gradient(140deg,#3B0A12,#8a1b2a)",
            glyph: "ಹೊ",
          })
          .returning({ id: submissions.id });
        return row;
      });

      return Response.json({ ok: true, id: inserted.id }, { status: 201 });
    } catch (error) {
      await del(blob.url).catch(() => undefined);
      if (error instanceof Error && error.message === "ENTRY_LIMIT") {
        return Response.json({ error: "Entry limit reached." }, { status: 409 });
      }
      if (error instanceof Error && error.message === "COMPETITION_CLOSED") {
        return Response.json(
          { error: "This competition is no longer accepting entries." },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[submission]", error);
    if (error instanceof Error && error.message === "Untrusted request origin.") {
      return Response.json({ error: error.message }, { status: 403 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Submission failed." },
      { status: 500 },
    );
  }
}
