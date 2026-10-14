import { randomUUID } from "node:crypto";
import type { Environment } from "@/config/env";
import type { AiRepository } from "@/server/repositories/ai-repository";
import type { VoiceSettingsUpdate } from "@/server/repositories/ai-repository";

export class AiSettingsService {
  constructor(private readonly repository: AiRepository, private readonly environment: Environment, private readonly clock = () => new Date()) {}
  status() {
    const settings = this.repository.getSettings();
    const monthStart = new Date(Date.UTC(this.clock().getUTCFullYear(), this.clock().getUTCMonth(), 1)).toISOString();
    const voiceUsage = this.repository.voiceUsageSummary(monthStart);
    return {
      cloudAiEnabled: settings.cloudAiEnabled,
      provider: "OpenAI",
      modelConfigured: Boolean(this.environment.OPENAI_MODEL),
      model: this.environment.OPENAI_MODEL ?? null,
      apiKeyConfigured: Boolean(this.environment.OPENAI_API_KEY),
      available: settings.cloudAiEnabled && Boolean(this.environment.OPENAI_MODEL && this.environment.OPENAI_API_KEY),
      voice: {
        enabled: settings.voiceEnabled,
        sttEnabled: settings.sttEnabled,
        voiceResponsesEnabled: settings.voiceResponsesEnabled,
        speakConfirmations: settings.speakConfirmations,
        speakBriefings: settings.speakBriefings,
        speakLongResponses: settings.speakLongResponses,
        automaticSpeechCharacterLimit: settings.automaticSpeechCharacterLimit,
        monthlyVoiceWarningSeconds: settings.monthlyVoiceWarningSeconds,
        sttModel: this.environment.OPENAI_STT_MODEL ?? null,
        ttsModel: this.environment.OPENAI_TTS_MODEL ?? null,
        sttConfigured: Boolean(this.environment.OPENAI_API_KEY && this.environment.OPENAI_STT_MODEL),
        ttsConfigured: Boolean(this.environment.OPENAI_API_KEY && this.environment.OPENAI_TTS_MODEL),
        usage: voiceUsage,
        monthlyWarningReached: settings.monthlyVoiceWarningSeconds !== null && voiceUsage.transcriptionDurationMs >= settings.monthlyVoiceWarningSeconds * 1_000,
      },
      usage: this.repository.usageSummary(),
    };
  }
  setCloudAiEnabled(enabled: boolean) { this.repository.setCloudAiEnabled(enabled, this.clock().toISOString()); return this.status(); }
  updateVoiceSettings(changes: VoiceSettingsUpdate) { this.repository.updateVoiceSettings(changes, this.clock().toISOString()); return this.status(); }
  recordUsage(input: { provider: string; model: string; inputTokens: number; outputTokens: number; requestCount: number }) {
    return this.repository.recordUsage({ id: randomUUID(), provider: input.provider, model: input.model, requestTimestamp: this.clock().toISOString(), inputTokens: input.inputTokens, outputTokens: input.outputTokens, requestCount: input.requestCount, estimatedCostMicros: null });
  }
  recordVoiceUsage(input: { kind: "transcription" | "speech"; provider: string; model: string; audioDurationMs?: number; inputCharacters?: number; outputBytes?: number }) {
    return this.repository.recordVoiceUsage({ id: randomUUID(), kind: input.kind, provider: input.provider, model: input.model, requestTimestamp: this.clock().toISOString(), audioDurationMs: input.audioDurationMs ?? null, inputCharacters: input.inputCharacters ?? null, outputBytes: input.outputBytes ?? null, estimatedCostMicros: null });
  }
}
