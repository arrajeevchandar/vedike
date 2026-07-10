import "server-only";
import { cache } from "react";
import { compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "vedike_admin";
const SESSION_SECONDS = 60 * 60 * 8;

function authKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be configured in production.");
  return new TextEncoder().encode(secret ?? "vedike-development-auth-secret-change-me");
}

export async function verifyAdminCredentials(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL ?? "admin@vedike.in";
  if (email.trim().toLowerCase() !== expectedEmail.toLowerCase()) return false;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return process.env.NODE_ENV !== "production" && password === "vedike-demo";
  return compare(password, hash);
}

export async function createAdminSession(email: string) {
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000);
  const token = await new SignJWT({ role: "admin", email })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expires).sign(authKey());
  const store = await cookies();
  store.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const getAdminSession = cache(async () => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authKey(), { algorithms: ["HS256"] });
    return payload.role === "admin" ? { email: String(payload.email), role: "admin" as const } : null;
  } catch { return null; }
});

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
