import { describe, expect, it, vi } from "vitest";
import { secondsUntilRateLimitReset } from "./rate-limit";

describe("rate limit helpers", () => {
  it("rounds reset timing up to the next second", () => {
    vi.setSystemTime(new Date("2026-06-09T10:00:00.000Z"));

    expect(secondsUntilRateLimitReset({ resetAt: Date.now() + 1201 })).toBe(2);
    expect(secondsUntilRateLimitReset({ resetAt: Date.now() })).toBe(0);

    vi.useRealTimers();
  });
});
