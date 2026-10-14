import { describe, expect, it } from "vitest";
import { MAX_VOICE_AUDIO_BYTES, MAX_VOICE_DURATION_MS, selectSpokenResponse, voiceAudioValidationError } from "@/domain/voice";
import type { JarvisResponse } from "@/domain/jarvis";

const base: JarvisResponse = { mode: "ambient", title: "Done", summary: "Done. I added it for tomorrow.", blocks: [], actions: [], navigation: null };
const settings = { voiceResponsesEnabled: true, speakConfirmations: true, speakBriefings: false, speakLongResponses: "ask" as const, automaticSpeechCharacterLimit: 80 };

describe("voice policy", () => {
  it("selects short speech and respects confirmation settings", () => {
    expect(selectSpokenResponse(base, settings)).toMatchObject({ text: base.summary, requiresApproval: false });
    const confirmation = { ...base, actions: [{ action: "create_task", reference: { entityType: "task" as const, entityId: "d050a94e-70b6-4a96-81bf-19bc2f9f9537", label: "Task", detail: "created" } }] };
    expect(selectSpokenResponse(confirmation, { ...settings, speakConfirmations: false }).text).toBeNull();
  });

  it("does not automatically read long workspace or briefing output", () => {
    const long = { ...base, mode: "workspace" as const, summary: "A".repeat(200) };
    expect(selectSpokenResponse(long, settings)).toMatchObject({ requiresApproval: true, reason: "long_response_requires_approval" });
    const briefing = { ...base, blocks: [{ type: "briefing_section" as const, heading: "Morning", text: "Facts", metrics: [], items: [] }] };
    expect(selectSpokenResponse(briefing, settings).text).toBeNull();
    expect(selectSpokenResponse(briefing, { ...settings, speakBriefings: true })).toMatchObject({ text: base.summary });
  });

  it("defines short-command size and duration guardrails", () => {
    expect(MAX_VOICE_AUDIO_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_VOICE_DURATION_MS).toBe(30_000);
    expect(voiceAudioValidationError({ byteLength: 100, durationMs: 30_001, mimeType: "audio/webm" })).toContain("30 seconds");
    expect(voiceAudioValidationError({ byteLength: MAX_VOICE_AUDIO_BYTES + 1, durationMs: 1_000, mimeType: "audio/webm" })).toContain("5 MB");
    expect(voiceAudioValidationError({ byteLength: 100, durationMs: 1_000, mimeType: "application/octet-stream" })).toContain("not supported");
    expect(voiceAudioValidationError({ byteLength: 100, durationMs: 1_000, mimeType: "audio/webm;codecs=opus" })).toBeNull();
  });
});
