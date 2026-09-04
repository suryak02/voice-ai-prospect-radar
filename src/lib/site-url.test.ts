import { describe, expect, it } from "vitest";
import { normalizeSiteUrl } from "./site-url";

describe("normalizeSiteUrl", () => {
  it("trims configured portfolio URLs and removes trailing slashes", () => {
    expect(normalizeSiteUrl(" https://voice-ai.example.com/// ")).toBe("https://voice-ai.example.com");
  });

  it("falls back to the production demo URL when the env value is missing or blank", () => {
    expect(normalizeSiteUrl(undefined)).toBe("https://voice-ai-prospect-map.vercel.app");
    expect(normalizeSiteUrl("   ")).toBe("https://voice-ai-prospect-map.vercel.app");
  });

  it("rejects invalid or non-web site URLs before building public metadata", () => {
    expect(normalizeSiteUrl("voice-ai.example.com")).toBe("https://voice-ai-prospect-map.vercel.app");
    expect(normalizeSiteUrl("ftp://voice-ai.example.com")).toBe("https://voice-ai-prospect-map.vercel.app");
    expect(normalizeSiteUrl("https://voice-ai.example.com/with/path")).toBe("https://voice-ai.example.com");
  });
});
