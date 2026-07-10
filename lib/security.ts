import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { headers } from "next/headers";

function masterKey() {
  const configured = process.env.PII_ENCRYPTION_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
    return createHash("sha256").update(configured).digest();
  }
  if (process.env.NODE_ENV === "production") throw new Error("PII_ENCRYPTION_KEY must be configured in production.");
  return createHash("sha256").update("vedike-development-only-key").digest();
}

function derivedKey(purpose: string) {
  return Buffer.from(hkdfSync("sha256", masterKey(), Buffer.alloc(0), purpose, 32));
}

export function encryptPii(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey("pii-encryption"), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((item) => item.toString("base64url")).join(".");
}

export function decryptPii(value: string | null | undefined) {
  if (!value) return "—";
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", derivedKey("pii-encryption"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function hashIdentity(value: string) {
  return createHmac("sha256", derivedKey("identity-hashing")).update(value).digest("hex");
}

export async function assertTrustedOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!origin || !host) return;
  const originHost = new URL(origin).host;
  if (originHost !== host) throw new Error("Untrusted request origin.");
}

export function redactProviderPayload(payload: Record<string, unknown>) {
  const allowed = ["event", "type", "merchantOrderId", "orderId", "state", "amount", "errorCode", "detailedErrorCode", "merchantRefundId", "refundId"];
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
}
