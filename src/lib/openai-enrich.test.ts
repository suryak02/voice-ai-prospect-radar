import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enrichBusiness, type EnrichInput } from "./openai-enrich";

const input: EnrichInput = {
  name: "Example Dental",
  category: "dental",
  address: "1 High Street, London",
  borough: "London",
  hasWebsite: false,
  hasOnlineBooking: false,
  hasVisiblePhone: true,
  voiceAiScore: 8,
  recommendedUseCase: "Missed-call handling",
};

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function reply(content: string) {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), { headers: { "Content-Type": "application/json" } }));
}

describe("enrichment response validation", () => {
  it.each(["null", "[]", "42", "true", '"text"', "not JSON", "{}"])(
    "returns no enrichment for unusable model output %s",
    async (content) => {
      reply(content);
      await expect(enrichBusiness(input)).resolves.toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps trimmed valid fields and normalizes an allowed category", async () => {
    reply(JSON.stringify({ summary: " Useful summary. ", angle: " Follow up. ", category: " DENTAL " }));
    await expect(enrichBusiness(input)).resolves.toEqual({
      summary: "Useful summary.", angle: "Follow up.", category: "dental", usedWebsite: false,
    });
  });

  it("ignores invalid field types and categories without discarding a usable angle", async () => {
    reply(JSON.stringify({ summary: 42, angle: " Ask about missed calls. ", category: "not-a-category" }));
    await expect(enrichBusiness(input)).resolves.toEqual({
      summary: "", angle: "Ask about missed calls.", category: undefined, usedWebsite: false,
    });
  });

  it("rejects a response whose summary and angle contain only whitespace", async () => {
    reply(JSON.stringify({ summary: " \n ", angle: "\t", category: "dental" }));
    await expect(enrichBusiness(input)).resolves.toBeNull();
  });
});
