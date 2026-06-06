import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis client.
 *
 * The app should remain deployable without Redis credentials: local development and
 * unconfigured preview deploys use in-memory fallbacks in the caller modules.
 */
let redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export function isRedisConfigured(): boolean {
  return getRedis() !== null;
}
