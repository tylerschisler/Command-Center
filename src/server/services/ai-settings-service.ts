import { randomUUID } from "node:crypto";
import type { Environment } from "@/config/env";
import type { AiRepository } from "@/server/repositories/ai-repository";

export class AiSettingsService {
  constructor(private readonly repository: AiRepository, private readonly environment: Environment, private readonly clock = () => new Date()) {}
  status() {
    const settings = this.repository.getSettings();
    return { cloudAiEnabled: settings.cloudAiEnabled, provider: "OpenAI", modelConfigured: Boolean(this.environment.OPENAI_MODEL), model: this.environment.OPENAI_MODEL ?? null, apiKeyConfigured: Boolean(this.environment.OPENAI_API_KEY), available: settings.cloudAiEnabled && Boolean(this.environment.OPENAI_MODEL && this.environment.OPENAI_API_KEY), usage: this.repository.usageSummary() };
  }
  setCloudAiEnabled(enabled: boolean) { this.repository.setCloudAiEnabled(enabled, this.clock().toISOString()); return this.status(); }
  recordUsage(input: { provider: string; model: string; inputTokens: number; outputTokens: number; requestCount: number }) {
    return this.repository.recordUsage({ id: randomUUID(), provider: input.provider, model: input.model, requestTimestamp: this.clock().toISOString(), inputTokens: input.inputTokens, outputTokens: input.outputTokens, requestCount: input.requestCount, estimatedCostMicros: null });
  }
}
