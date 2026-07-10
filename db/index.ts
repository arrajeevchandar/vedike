import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

type Db = ReturnType<typeof createDb>;
let instance: Db | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return drizzle(neon(url), { schema });
}

export function getDb() {
  if (!instance) instance = createDb();
  return instance;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
