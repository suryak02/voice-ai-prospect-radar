import { afterEach, describe, expect, it } from "vitest";
import { getEnvValue } from "./env";

const previous = process.env.TEST_ENV_SANITIZE;

afterEach(() => {
  if (previous === undefined) {
    delete process.env.TEST_ENV_SANITIZE;
  } else {
    process.env.TEST_ENV_SANITIZE = previous;
  }
});

describe("getEnvValue", () => {
  it("trims whitespace and leading byte-order marks from env values", () => {
    process.env.TEST_ENV_SANITIZE = "\uFEFFhttps://example.com  ";

    expect(getEnvValue("TEST_ENV_SANITIZE")).toBe("https://example.com");
  });

  it("treats empty sanitized values as missing", () => {
    process.env.TEST_ENV_SANITIZE = "   ";

    expect(getEnvValue("TEST_ENV_SANITIZE")).toBeUndefined();
  });
});
