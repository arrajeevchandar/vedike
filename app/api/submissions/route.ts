import { randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import sharp from "sharp";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { competitions, entryIdentityCounters, submissions } from "@/db/schema";
import { deriveStatus, normalizeEmail, normalizeIndianPhone } from "@/lib/domain";
import { encryptPii, hashIdentity } from "@/lib/security";
import { checkRateLimit } from "@/lib/rate-limit";
import { submissionSchema } from "@/lib/validation";

export const runtime = "nodejs";
const MAX_BYTES = 4_000_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    if (!hasDatabase()) return Response.json({ error: "Database setup is required before accepting real submissions." }, { status: 503 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limited = await checkRateLimit("submission", ip, 5, "1 h");
    if (!limited.success) return Response.json({ error: "Too many submissions. Please try later." }, { status: 429 });
    const form = await request.formData();
    const parsed = submissionSchema.safeParse({ competitionId: form.get("competitionId"), name: form.get("name"), phone: form.get("phone"), email: form.get("email"), description: form.get("description") });
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid entry." }, { status: 400 });
    const file = form.get("photo");
    if (!(file instanceof File) || !ALLOWED.has(file.type) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ error: "Upload a JPEG, PNG or WebP image under 4 MB." }, { status: 400 });
    const phone = normalizeIndianPhone(parsed.data.phone), email = normalizeEmail(parsed.data.email);
    const phoneHash = hashIdentity(`phone:${phone}`), emailHash = hashIdentity(`email:${email}`);
    const db = getDb();
    const [competition] = await db.select().from(competitions).where(eq(competitions.id, parsed.data.competitionId)).limit(1);
    if (!competition || competition.isShowcase || competition.lifecycle !== "PUBLISHED" || deriveStatus(competition) !== "live") return Response.json({ error: "This competition is not accepting entries." }, { status: 409 });
    const existing = await db.select().from(entryIdentityCounters).where(and(eq(entryIdentityCounters.competitionId, competition.id), inArray(entryIdentityCounters.identityHash, [phoneHash, emailHash])));
    const limit = competition.maxEntriesPerParticipant;
    if (limit && existing.some((row) => row.count >= limit)) return Response.json({ error: `This competition allows ${limit} entr${limit === 1 ? "y" : "ies"} per participant.` }, { status: 409 });
    const sanitized = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
    const blob = await put(`submissions/${competition.id}/${randomUUID()}.webp`, sanitized, { access: "public", contentType: "image/webp", addRandomSuffix: true });
    try {
      const inserted = await db.transaction(async (tx) => {
        const latest = await tx.select().from(entryIdentityCounters).where(and(eq(entryIdentityCounters.competitionId, competition.id), inArray(entryIdentityCounters.identityHash, [phoneHash, emailHash])));
        if (limit && latest.some((row) => row.count >= limit)) throw new Error("ENTRY_LIMIT");
        for (const identityHash of [phoneHash, emailHash]) await tx.insert(entryIdentityCounters).values({ competitionId: competition.id, identityHash, count: 1 }).onConflictDoUpdate({ target: [entryIdentityCounters.competitionId, entryIdentityCounters.identityHash], set: { count: sql`${entryIdentityCounters.count} + 1`, updatedAt: new Date() } });
        const [row] = await tx.insert(submissions).values({ competitionId: competition.id, participantName: parsed.data.name, participantPhoneEncrypted: encryptPii(phone), participantPhoneHash: phoneHash, participantEmailEncrypted: encryptPii(email), participantEmailHash: emailHash, description: parsed.data.description, imageUrl: blob.url, imageKey: blob.pathname, tile: "linear-gradient(140deg,#3B0A12,#8a1b2a)", glyph: "ಹೊ" }).returning({ id: submissions.id });
        return row;
      });
      return Response.json({ ok: true, id: inserted.id }, { status: 201 });
    } catch (error) { await del(blob.url).catch(() => undefined); if (error instanceof Error && error.message === "ENTRY_LIMIT") return Response.json({ error: "Entry limit reached." }, { status: 409 }); throw error; }
  } catch (error) { console.error("[submission]", error); return Response.json({ error: error instanceof Error ? error.message : "Submission failed." }, { status: 500 }); }
}
