import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

export async function checkRateLimit(namespace: string, identifier: string, limit: number, window: `${number} ${"s" | "m" | "h"}`) {
  const client = getRedis();
  if (!client) return { success: true, remaining: limit };
  const key = `${namespace}:${limit}:${window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({ redis: client, limiter: Ratelimit.slidingWindow(limit, window), prefix: `vedike:${namespace}`, analytics: true });
    limiters.set(key, limiter);
  }
  return limiter.limit(identifier);
}
