import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { aiSettings, aiUsageRecords, voiceUsageRecords, type AiSettings, type AiUsageRecord, type NewAiUsageRecord, type NewVoiceUsageRecord, type VoiceUsageRecord } from "@/server/db/schema";

export type VoiceSettingsUpdate = Partial<Pick<AiSettings,
  "voiceEnabled" | "sttEnabled" | "voiceResponsesEnabled" | "speakConfirmations" | "speakBriefings" |
  "speakLongResponses" | "automaticSpeechCharacterLimit" | "monthlyVoiceWarningSeconds" |
  "monthlyCostWarningMicros" | "monthlyCostCutoffMicros" | "hardCostCutoffEnabled"
>>;

export interface AiRepository {
  getSettings(): AiSettings;
  setCloudAiEnabled(enabled: boolean, updatedAt: string): AiSettings;
  updateVoiceSettings(changes: VoiceSettingsUpdate, updatedAt: string): AiSettings;
  recordUsage(record: NewAiUsageRecord): AiUsageRecord;
  recordVoiceUsage(record: NewVoiceUsageRecord): VoiceUsageRecord;
  usageSummary(monthStart?: string): { requests: number; inputTokens: number; outputTokens: number; estimatedCostMicros: number; unknownCostRecords: number; recent: AiUsageRecord[] };
  voiceUsageSummary(monthStart: string): { transcriptionRequests: number; speechRequests: number; transcriptionDurationMs: number; speechCharacters: number; speechBytes: number; estimatedCostMicros: number; unknownCostRecords: number; recent: VoiceUsageRecord[] };
}

export class DrizzleAiRepository implements AiRepository {
  constructor(private readonly database: AppDatabase) {}
  getSettings(): AiSettings {
    const existing = this.database.select().from(aiSettings).where(eq(aiSettings.id, "default")).get();
    if (existing) return existing;
    return this.database.insert(aiSettings).values({ id: "default", cloudAiEnabled: false, updatedAt: new Date().toISOString() }).returning().get();
  }
  setCloudAiEnabled(enabled: boolean, updatedAt: string): AiSettings {
    this.getSettings();
    return this.database.update(aiSettings).set({ cloudAiEnabled: enabled, updatedAt }).where(eq(aiSettings.id, "default")).returning().get();
  }
  updateVoiceSettings(changes: VoiceSettingsUpdate, updatedAt: string): AiSettings {
    this.getSettings();
    return this.database.update(aiSettings).set({ ...changes, updatedAt }).where(eq(aiSettings.id, "default")).returning().get();
  }
  recordUsage(record: NewAiUsageRecord) { return this.database.insert(aiUsageRecords).values(record).returning().get(); }
  recordVoiceUsage(record: NewVoiceUsageRecord) { return this.database.insert(voiceUsageRecords).values(record).returning().get(); }
  usageSummary(monthStart?: string) {
    const condition = monthStart ? gte(aiUsageRecords.requestTimestamp, monthStart) : undefined;
    const totals = this.database.select({ requests: sql<number>`coalesce(sum(${aiUsageRecords.requestCount}), 0)`, inputTokens: sql<number>`coalesce(sum(${aiUsageRecords.inputTokens}), 0)`, outputTokens: sql<number>`coalesce(sum(${aiUsageRecords.outputTokens}), 0)`, estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageRecords.estimatedCostMicros}), 0)`, unknownCostRecords: sql<number>`sum(case when ${aiUsageRecords.estimatedCostMicros} is null then 1 else 0 end)` }).from(aiUsageRecords).where(condition).get();
    return { requests: Number(totals?.requests ?? 0), inputTokens: Number(totals?.inputTokens ?? 0), outputTokens: Number(totals?.outputTokens ?? 0), estimatedCostMicros: Number(totals?.estimatedCostMicros ?? 0), unknownCostRecords: Number(totals?.unknownCostRecords ?? 0), recent: this.database.select().from(aiUsageRecords).orderBy(desc(aiUsageRecords.requestTimestamp)).limit(20).all() };
  }
  voiceUsageSummary(monthStart: string) {
    const month = gte(voiceUsageRecords.requestTimestamp, monthStart);
    const transcription = this.database.select({ requests: sql<number>`count(*)`, duration: sql<number>`coalesce(sum(${voiceUsageRecords.audioDurationMs}), 0)` }).from(voiceUsageRecords).where(and(month, eq(voiceUsageRecords.kind, "transcription"))).get();
    const speech = this.database.select({ requests: sql<number>`count(*)`, characters: sql<number>`coalesce(sum(${voiceUsageRecords.inputCharacters}), 0)`, bytes: sql<number>`coalesce(sum(${voiceUsageRecords.outputBytes}), 0)` }).from(voiceUsageRecords).where(and(month, eq(voiceUsageRecords.kind, "speech"))).get();
    return {
      transcriptionRequests: Number(transcription?.requests ?? 0),
      speechRequests: Number(speech?.requests ?? 0),
      transcriptionDurationMs: Number(transcription?.duration ?? 0),
      speechCharacters: Number(speech?.characters ?? 0),
      speechBytes: Number(speech?.bytes ?? 0),
      estimatedCostMicros: Number(this.database.select({ value: sql<number>`coalesce(sum(${voiceUsageRecords.estimatedCostMicros}), 0)` }).from(voiceUsageRecords).where(month).get()?.value ?? 0),
      unknownCostRecords: Number(this.database.select({ value: sql<number>`sum(case when ${voiceUsageRecords.estimatedCostMicros} is null then 1 else 0 end)` }).from(voiceUsageRecords).where(month).get()?.value ?? 0),
      recent: this.database.select().from(voiceUsageRecords).orderBy(desc(voiceUsageRecords.requestTimestamp)).limit(20).all(),
    };
  }
}
