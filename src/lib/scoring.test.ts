import { describe, expect, it } from "vitest";
import {
  calculateVoiceAiScore,
  getScoreColorClasses,
  getScoreLabel,
} from "./scoring";
import type { ScoreInput } from "./types";

const baseInput: ScoreInput = {
  category: "dental",
  hasWebsite: true,
  hasOnlineBooking: false,
  hasVisiblePhone: true,
  appointmentBased: true,
  highValueService: true,
  reviewPainSignals: [],
  reviewCount: 120,
};

describe("calculateVoiceAiScore", () => {
  it("scores appointment-heavy phone-dependent clinics as high priority", () => {
    const result = calculateVoiceAiScore({
      ...baseInput,
      reviewPainSignals: ["missed calls", "hard to book appointments"],
    });

    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.score).toBeLessThanOrEqual(9);
    expect(result.breakdown.categoryFit).toBe(2);
    expect(result.breakdown.callDependency).toBe(2);
    expect(result.breakdown.schedulingComplexity).toBe(2);
  });

  it("scores low-fit businesses lower even when they have reviews", () => {
    const result = calculateVoiceAiScore({
      ...baseInput,
      category: "retail",
      appointmentBased: false,
      highValueService: false,
      hasOnlineBooking: true,
      reviewPainSignals: [],
      reviewCount: 300,
    });

    expect(result.score).toBeLessThanOrEqual(3);
    expect(result.breakdown.categoryFit).toBe(0);
  });

  it("penalizes weak public data so the score is not overconfident", () => {
    const withMissingSignals = calculateVoiceAiScore({
      ...baseInput,
      hasWebsite: false,
      hasVisiblePhone: false,
      reviewCount: undefined,
    });

    const withStrongSignals = calculateVoiceAiScore(baseInput);

    expect(withMissingSignals.score).toBeLessThan(withStrongSignals.score);
    expect(withMissingSignals.breakdown.confidencePenalty).toBeLessThan(0);
  });
});

describe("score presentation helpers", () => {
  it("labels scores in human-friendly prospect tiers", () => {
    expect(getScoreLabel(1)).toBe("Poor fit");
    expect(getScoreLabel(4)).toBe("Low priority");
    expect(getScoreLabel(6)).toBe("Promising");
    expect(getScoreLabel(8)).toBe("Strong candidate");
    expect(getScoreLabel(9)).toBe("Highest priority");
  });

  it("returns colour classes for marker rendering", () => {
    expect(getScoreColorClasses(1)).toContain("bg-slate-600");
    expect(getScoreColorClasses(6)).toContain("bg-amber-400");
    expect(getScoreColorClasses(9)).toContain("bg-fuchsia-500");
  });
});
