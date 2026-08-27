import { describe, expect, it } from "vitest";
import { getClientIpFromHeaders } from "./request-ip";

function headers(values: Record<string, string | null>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

describe("getClientIpFromHeaders", () => {
  it("uses the first usable forwarded IP", () => {
    expect(
      getClientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.10, 198.51.100.7", "x-real-ip": "198.51.100.9" })),
    ).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip when forwarded IP is missing or unknown", () => {
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": " unknown ", "x-real-ip": "198.51.100.9" }))).toBe(
      "198.51.100.9",
    );
  });

  it("rejects unsafe header values before using the local fallback", () => {
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.10\nspoofed", "x-real-ip": "" }))).toBe(
      "local",
    );
  });
});
