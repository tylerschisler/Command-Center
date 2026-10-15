import { describe, expect, it } from "vitest";
import { normalizeJarvisSettingsStatus, SAFE_JARVIS_SETTINGS } from "@/domain/ai-settings";

describe("Jarvis settings normalization", () => {
  it("normalizes missing and legacy voice settings to safe disabled defaults", () => {
    expect(normalizeJarvisSettingsStatus(undefined)).toEqual(SAFE_JARVIS_SETTINGS);
    expect(normalizeJarvisSettingsStatus({ cloudAiEnabled: true })).toEqual({ ...SAFE_JARVIS_SETTINGS, cloudAiEnabled: true });
  });

  it("preserves complete configured voice settings and fills partial fields", () => {
    expect(normalizeJarvisSettingsStatus({ cloudAiEnabled: true, voice: { enabled: true, sttEnabled: true, voiceResponsesEnabled: true, sttConfigured: true, ttsConfigured: true } })).toEqual({ cloudAiEnabled: true, voice: { enabled: true, sttEnabled: true, voiceResponsesEnabled: true, sttConfigured: true, ttsConfigured: true } });
    expect(normalizeJarvisSettingsStatus({ voice: { enabled: true } }).voice).toEqual({ enabled: true, sttEnabled: false, voiceResponsesEnabled: false, sttConfigured: false, ttsConfigured: false });
  });
});
