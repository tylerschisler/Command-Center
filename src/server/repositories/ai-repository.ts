import { desc, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { aiSettings, aiUsageRecords, type AiSettings, type AiUsageRecord, type NewAiUsageRecord } from "@/server/db/schema";

export interface AiRepository {
  getSettings(): AiSettings;
  setCloudAiEnabled(enabled: boolean, updatedAt: string): AiSettings;
  recordUsage(record: NewAiUsageRecord): AiUsageRecord;
  usageSummary(): { requests: number; inputTokens: number; outputTokens: number; recent: AiUsageRecord[] };
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
  recordUsage(record: NewAiUsageRecord) { return this.database.insert(aiUsageRecords).values(record).returning().get(); }
  usageSummary() {
    const totals = this.database.select({ requests: sql<number>`coalesce(sum(${aiUsageRecords.requestCount}), 0)`, inputTokens: sql<number>`coalesce(sum(${aiUsageRecords.inputTokens}), 0)`, outputTokens: sql<number>`coalesce(sum(${aiUsageRecords.outputTokens}), 0)` }).from(aiUsageRecords).get();
    return { requests: Number(totals?.requests ?? 0), inputTokens: Number(totals?.inputTokens ?? 0), outputTokens: Number(totals?.outputTokens ?? 0), recent: this.database.select().from(aiUsageRecords).orderBy(desc(aiUsageRecords.requestTimestamp)).limit(20).all() };
  }
}
