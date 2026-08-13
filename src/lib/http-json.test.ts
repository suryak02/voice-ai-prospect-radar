import { describe, expect, it } from "vitest";
import { readJsonResponse } from "./http-json";

describe("readJsonResponse", () => {
  it("returns parsed JSON on success", async () => {
    await expect(readJsonResponse<{ ok: boolean }>(Response.json({ ok: true }))).resolves.toEqual({ ok: true });
  });

  it("uses API error messages for failed JSON responses", async () => {
    const response = Response.json({ error: "Database is unavailable." }, { status: 503 });

    await expect(readJsonResponse(response)).rejects.toThrow("Database is unavailable.");
  });


  it("also surfaces API message and detail fields from failed responses", async () => {
    await expect(readJsonResponse(Response.json({ message: "Quota exceeded." }, { status: 429 }))).rejects.toThrow(
      "Quota exceeded.",
    );
    await expect(readJsonResponse(Response.json({ detail: "Invalid postcode." }, { status: 400 }))).rejects.toThrow(
      "Invalid postcode.",
    );
  });

  it("turns empty failed responses into actionable errors", async () => {
    const response = new Response(null, { status: 500 });

    await expect(readJsonResponse(response)).rejects.toThrow("server returned no error body");
  });
});
