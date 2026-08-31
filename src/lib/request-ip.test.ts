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

  it("falls back to the standard Forwarded header before x-real-ip", () => {
    expect(
      getClientIpFromHeaders(
        headers({ forwarded: "for=\"[2001:db8::5]:443\";proto=https, for=198.51.100.8", "x-real-ip": "198.51.100.9" }),
      ),
    ).toBe("2001:db8::5");
  });

  it("falls back to x-real-ip when forwarded IP is missing or unknown", () => {
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": " unknown ", forwarded: "for=unknown", "x-real-ip": "198.51.100.9" }))).toBe(
      "198.51.100.9",
    );
  });

  it("rejects unsafe header values before using the local fallback", () => {
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.10\nspoofed", "x-real-ip": "" }))).toBe(
      "local",
    );
  });

  it("normalizes forwarded IP values with proxy-added ports", () => {
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": "198.51.100.7:443", "x-real-ip": "" }))).toBe(
      "198.51.100.7",
    );
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": "[2001:db8::1]:443", "x-real-ip": "" }))).toBe(
      "2001:db8::1",
    );
  });

  it("rejects hostnames and malformed IPv4 values from client-controlled headers", () => {
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": "example.com", "x-real-ip": "" }))).toBe("local");
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": "999.0.0.1", "x-real-ip": "" }))).toBe("local");
  });

  it("rejects malformed IPv6 candidates instead of creating spoofable buckets", () => {
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": "::::", "x-real-ip": "" }))).toBe("local");
    expect(getClientIpFromHeaders(headers({ "x-forwarded-for": "1:2:3:4:5:6:7:8:9", "x-real-ip": "" }))).toBe("local");
  });
});
