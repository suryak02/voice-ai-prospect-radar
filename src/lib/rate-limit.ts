import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

// Shared rate limiting. When Upstash Redis is configured, limits are enforced
// globally across all serverless instances (the correct behaviour). When it
// isn't (local dev, or an unconfigured deploy), it falls back to a best-effort
// in-memory counter that is per-instance — same API, weaker guarantee.

type RateLimitOptions = { key: string; limit: number; windowMs: number };
type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

// One Upstash limiter per (limit, windowMs), created lazily and cached.
const limiterCache = new Map<string, Ratelimit>();
function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
      prefix: "rl",
      analytics: false,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

export async function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  const limiter = getLimiter(limit, windowMs);
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      return { allowed: result.success, remaining: result.remaining, resetAt: result.reset };
    } catch (error) {
      // If Redis is briefly unavailable, fail open to the in-memory fallback
      // rather than blocking all requests.
      console.error("Rate limit (Redis) failed; using in-memory fallback.", error);
    }
  }
  return inMemoryCheck({ key, limit, windowMs });
}

// ---- In-memory fallback (per serverless instance) ----

type RateLimitEntry = { count: number; resetAt: number };
const buckets = new Map<string, RateLimitEntry>();

function inMemoryCheck({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function cleanupRateLimitBuckets() {
  const now = Date.now();
  for (const [key, entry] of Array.from(buckets.entries())) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}
