import { describe, expect, it } from "vitest";
import { estimateSpeechCostMicros, estimateTextCostMicros, estimateTranscriptionCostMicros } from "@/config/pricing";

describe("maintainable usage pricing", () => {
  it("estimates known models and leaves unknown model prices unknown", () => {
    expect(estimateTextCostMicros("gpt-5.6-terra", 1_000_000, 1_000_000)).toBe(14_000_000);
    expect(estimateTextCostMicros("gpt-5.6-terra", 1_000_000, 1_000_000, 500_000)).toBe(13_100_000);
    expect(estimateTextCostMicros("gpt-4o-mini", 1_000_000, 1_000_000)).toBe(750_000);
    expect(estimateTranscriptionCostMicros("gpt-4o-mini-transcribe", 60_000)).toBe(3_000);
    expect(estimateSpeechCostMicros("tts-1", 1_000_000)).toBe(15_000_000);
    expect(estimateTextCostMicros("future-model", 100, 100, 50)).toBeNull();
  });
});
