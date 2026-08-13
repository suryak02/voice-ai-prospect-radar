import { describe, expect, it } from "vitest";
import {
  calculateVoiceAiScore,
  clampScore,
  getScoreColorClasses,
  getScoreLabel,
  getScorePillClasses,
  getScoreTier,
  isPriorityProspectScore,
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
  it("clamps calculated scores to the supported 0-9 range", () => {
    expect(clampScore(-3)).toBe(0);
    expect(clampScore(4)).toBe(4);
    expect(clampScore(12)).toBe(9);
  });

  it("maps scores to stable tier keys for analytics and UI summaries", () => {
    expect(getScoreTier(1)).toBe("poor_fit");
    expect(getScoreTier(4)).toBe("low_priority");
    expect(getScoreTier(6)).toBe("promising");
    expect(getScoreTier(8)).toBe("strong_candidate");
    expect(getScoreTier(9)).toBe("highest_priority");
  });

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


  it("identifies scores that deserve human review", () => {
    expect(isPriorityProspectScore(6)).toBe(false);
    expect(isPriorityProspectScore(7)).toBe(true);
    expect(isPriorityProspectScore(9)).toBe(true);
  });

  it("returns pill classes for low, promising, and highest-priority score tiers", () => {
    expect(getScorePillClasses(1)).toContain("border-white/10");
    expect(getScorePillClasses(6)).toContain("border-amber-300/30");
    expect(getScorePillClasses(9)).toContain("border-fuchsia-400/30");
  });
});
