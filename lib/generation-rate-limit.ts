import "server-only";

import { Redis } from "@upstash/redis";

import { logServerError } from "@/lib/server/safe-client-error";

/** Generations (week plans, day regenerations, lookbooks) per user per window. */
export const GENERATIONS_PER_WINDOW = 20;
const WINDOW_SECONDS = 60 * 60;

export type GenerationLimit =
  { allowed: true } | { allowed: false; message: string };

function readValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** UPSTASH_REDIS_REST_* first, then Vercel's KV_REST_API_*; null when unset. */
function redisFromEnv(env: NodeJS.ProcessEnv): Redis | null {
  const url =
    readValue(env.UPSTASH_REDIS_REST_URL) ?? readValue(env.KV_REST_API_URL);
  const token =
    readValue(env.UPSTASH_REDIS_REST_TOKEN) ?? readValue(env.KV_REST_API_TOKEN);
  if (!url || !token) return null;
  return new Redis({ url, token, retry: { retries: 0 } });
}

function keyFor(userId: string, env: NodeJS.ProcessEnv): string {
  const environment =
    readValue(env.VERCEL_ENV) ?? readValue(env.NODE_ENV) ?? "development";
  return `project-blue-jeans:${environment}:generation:${userId}`;
}

/**
 * Count one generation for this user in a fixed hourly window. Uses Upstash
 * (shared across serverless instances) and does nothing when Upstash is not
 * configured. A Redis failure also lets the request through: the limit is
 * cost protection, not a security boundary, so it must not take generation
 * down with it.
 */
export async function consumeGeneration(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<GenerationLimit> {
  const redis = redisFromEnv(env);
  if (!redis) return { allowed: true };

  try {
    const key = keyFor(userId, env);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
    if (count <= GENERATIONS_PER_WINDOW) return { allowed: true };

    const ttl = await redis.ttl(key);
    if (ttl < 0) await redis.expire(key, WINDOW_SECONDS);
    const minutes = Math.max(
      1,
      Math.ceil((ttl > 0 ? ttl : WINDOW_SECONDS) / 60),
    );
    return {
      allowed: false,
      message: `You've reached the limit of ${GENERATIONS_PER_WINDOW} generations per hour. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  } catch (e) {
    logServerError("consumeGeneration", e);
    return { allowed: true };
  }
}
