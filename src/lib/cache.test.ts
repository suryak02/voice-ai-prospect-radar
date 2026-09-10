import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getRedis, redis } = vi.hoisted(() => ({
  getRedis: vi.fn(),
  redis: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("./redis", () => ({ getRedis }));

// Reset module state to keep memory-cache entries isolated between tests.
async function cache() {
  return import("./cache");
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T09:00:00Z"));
  getRedis.mockReturnValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("cache fallback", () => {
  it.each([{ value: false }, { value: 0 }, { value: "" }, { value: [] }])(
    "prefers a Redis hit over older fallback data even for $value",
    async ({ value }) => {
      const { getCache, setCache } = await cache();
      await setCache("prospects", ["older fallback"], 60);
      getRedis.mockReturnValue(redis);
      redis.get.mockResolvedValue(value);

      await expect(getCache("prospects")).resolves.toEqual({ value, source: "redis" });
      expect(redis.get).toHaveBeenCalledWith("prospects");
    },
  );

  it("uses unexpired fallback data on a Redis miss without extending its lifetime", async () => {
    const { getCache, setCache } = await cache();
    await setCache("prospects", ["fallback"], 60);
    getRedis.mockReturnValue(redis);
    redis.get.mockResolvedValue(null);

    vi.advanceTimersByTime(59_999);
    await expect(getCache("prospects")).resolves.toEqual({ value: ["fallback"], source: "memory" });
    vi.advanceTimersByTime(1);
    await expect(getCache("prospects")).resolves.toEqual({ value: null, source: "miss" });
  });

  it("expires fallback data at the exact TTL boundary", async () => {
    const { getCache, setCache } = await cache();
    await setCache("prospects", ["saved"], 60);
    vi.advanceTimersByTime(59_999);
    await expect(getCache("prospects")).resolves.toEqual({ value: ["saved"], source: "memory" });
    vi.advanceTimersByTime(1);
    await expect(getCache("prospects")).resolves.toEqual({ value: null, source: "miss" });
  });

  it("does not resurrect an older fallback after a successful Redis replacement", async () => {
    const { getCache, setCache } = await cache();
    await setCache("prospects", ["old"], 60);
    getRedis.mockReturnValue(redis);
    redis.set.mockResolvedValue("OK");
    await setCache("prospects", ["new"], 60);
    expect(redis.set).toHaveBeenCalledWith("prospects", ["new"], { ex: 60 });

    redis.get.mockResolvedValue(null);
    await expect(getCache("prospects")).resolves.toEqual({ value: null, source: "miss" });
    redis.get.mockRejectedValue(new Error("Redis unavailable"));
    await expect(getCache("prospects")).resolves.toEqual({ value: null, source: "miss" });
  });

  it("still stores fresh fallback data when a Redis write fails", async () => {
    const { getCache, setCache } = await cache();
    await setCache("prospects", ["old"], 60);
    getRedis.mockReturnValue(redis);
    redis.set.mockRejectedValue(new Error("Redis unavailable"));
    redis.get.mockRejectedValue(new Error("Redis unavailable"));
    await setCache("prospects", ["new"], 60);
    await expect(getCache("prospects")).resolves.toEqual({ value: ["new"], source: "memory" });
  });
});
