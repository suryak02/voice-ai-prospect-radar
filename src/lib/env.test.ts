import { afterEach, describe, expect, it } from "vitest";
import { getBooleanEnvValue, getEnvValue } from "./env";

const previous = process.env.TEST_ENV_SANITIZE;

afterEach(() => {
  if (previous === undefined) {
    delete process.env.TEST_ENV_SANITIZE;
  } else {
    process.env.TEST_ENV_SANITIZE = previous;
  }
  it("parses common truthy boolean feature flags", () => {
    process.env.TEST_ENV_SANITIZE = " yes ";

    expect(getBooleanEnvValue("TEST_ENV_SANITIZE")).toBe(true);
  });

  it("treats missing or non-truthy boolean feature flags as disabled", () => {
    process.env.TEST_ENV_SANITIZE = "false";

    expect(getBooleanEnvValue("TEST_ENV_SANITIZE")).toBe(false);
    expect(getBooleanEnvValue("MISSING_TEST_ENV_SANITIZE")).toBe(false);
  });
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
  it("parses common truthy boolean feature flags", () => {
    process.env.TEST_ENV_SANITIZE = " yes ";

    expect(getBooleanEnvValue("TEST_ENV_SANITIZE")).toBe(true);
  });

  it("treats missing or non-truthy boolean feature flags as disabled", () => {
    process.env.TEST_ENV_SANITIZE = "false";

    expect(getBooleanEnvValue("TEST_ENV_SANITIZE")).toBe(false);
    expect(getBooleanEnvValue("MISSING_TEST_ENV_SANITIZE")).toBe(false);
  });
});
