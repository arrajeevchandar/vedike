import "server-only";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";

neonConfig.webSocketConstructor = ws;

type Db = ReturnType<typeof createDb>;
let instance: Db | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: url });
  pool.on("error", (error: Error) => console.error("[neon-pool]", error));
  return drizzle(pool, { schema });
}

export function getDb() {
  if (!instance) instance = createDb();
  return instance;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
