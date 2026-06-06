import { getRedis } from "@/lib/redis";

type CacheEntry<T> = { expiresAt: number; value: T };

const memoryCache = new Map<string, CacheEntry<unknown>>();

export type CacheRead<T> = { value: T | null; source: "redis" | "memory" | "miss" };

export async function getCache<T>(key: string): Promise<CacheRead<T>> {
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get<T>(key);
      if (value !== null) return { value, source: "redis" };
    } catch (error) {
      console.error("Redis cache read failed; falling back to in-memory cache.", error);
    }
  }

  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!cached) return { value: null, source: "miss" };
  if (cached.expiresAt <= now) {
    memoryCache.delete(key);
    return { value: null, source: "miss" };
  }
  return { value: cached.value, source: "memory" };
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
      return;
    } catch (error) {
      console.error("Redis cache write failed; using in-memory cache.", error);
    }
  }

  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cleanupMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of Array.from(memoryCache.entries())) {
    if (entry.expiresAt <= now) memoryCache.delete(key);
  }
}
