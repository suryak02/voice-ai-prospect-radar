import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, secondsUntilRateLimitReset } from "./rate-limit";

describe("rate limit helpers", () => {
  it("rounds reset timing up to the next second", () => {
    vi.setSystemTime(new Date("2026-06-09T10:00:00.000Z"));

    expect(secondsUntilRateLimitReset({ resetAt: Date.now() + 1201 })).toBe(2);
    expect(secondsUntilRateLimitReset({ resetAt: Date.now() })).toBe(0);

    vi.useRealTimers();
  });

  it("keeps in-memory buckets isolated by quota settings", async () => {
    const sharedKey = "maintenance-shared-key";

    await expect(checkRateLimit({ key: sharedKey, limit: 2, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(checkRateLimit({ key: sharedKey, limit: 2, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });

    await expect(checkRateLimit({ key: sharedKey, limit: 1, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });
});
