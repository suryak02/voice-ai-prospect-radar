import { describe, expect, it } from "vitest";
import { mockBusinesses } from "./mock-businesses";
import { buildSpecificReasoning } from "./prospect-insights";
import { getScoreLabel } from "./scoring";

describe("prospect reasoning score framing", () => {
  it.each([0, 2, 3, 4])("does not pitch a low-fit score of %s as a realistic automation fit", (voiceAiScore) => {
    const [opening] = buildSpecificReasoning({ ...mockBusinesses[0], voiceAiScore });

    expect(opening).toContain(`${voiceAiScore}/9 (${getScoreLabel(voiceAiScore).toLowerCase()})`);
    expect(opening).toContain("limited");
    expect(opening).not.toContain("realistic front-desk automation use case");
  });

  it.each([5, 6, 7, 9])("preserves positive framing for a promising-or-better score of %s", (voiceAiScore) => {
    const [opening] = buildSpecificReasoning({ ...mockBusinesses[0], voiceAiScore });

    expect(opening).toContain(`${voiceAiScore}/9 (${getScoreLabel(voiceAiScore).toLowerCase()})`);
    expect(opening).toContain("realistic front-desk automation use case");
  });
});
