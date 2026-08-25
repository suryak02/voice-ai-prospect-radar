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

  it("trims API error messages before showing them to reviewers", async () => {
    const response = Response.json({ error: "  Database is unavailable.\n" }, { status: 503 });

    await expect(readJsonResponse(response)).rejects.toThrow(/^Database is unavailable\.$/);
  });

  it("surfaces nested provider error messages from failed JSON responses", async () => {
    const response = Response.json({ error: { message: "API key is invalid." } }, { status: 403 });

    await expect(readJsonResponse(response)).rejects.toThrow("API key is invalid.");
  });

  it("also surfaces API message and detail fields from failed responses", async () => {
    await expect(readJsonResponse(Response.json({ message: "Quota exceeded." }, { status: 429 }))).rejects.toThrow(
      "Quota exceeded.",
    );
    await expect(readJsonResponse(Response.json({ detail: "Invalid postcode." }, { status: 400 }))).rejects.toThrow(
      "Invalid postcode.",
    );
  });

  it("combines array-style provider error messages", async () => {
    const response = Response.json(
      { errors: [{ message: "Area is required." }, { message: "Choose at least one category." }] },
      { status: 400 },
    );

    await expect(readJsonResponse(response)).rejects.toThrow("Area is required.; Choose at least one category.");
  });

  it("turns empty failed responses into actionable errors", async () => {
    const response = new Response(null, { status: 500 });

    await expect(readJsonResponse(response)).rejects.toThrow("server returned no error body");
  });

  it("turns empty successful responses into actionable errors", async () => {
    const response = new Response(null, { status: 204 });

    await expect(readJsonResponse(response)).rejects.toThrow("server returned no JSON body");
  });

  it("distinguishes invalid JSON in failed and successful responses", async () => {
    await expect(readJsonResponse(new Response("not-json", { status: 502 }))).rejects.toThrow(
      "server returned invalid JSON",
    );
    await expect(readJsonResponse(new Response("not-json", { status: 200 }))).rejects.toThrow(
      "server returned invalid JSON",
    );
  });
});
