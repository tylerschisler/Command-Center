import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import type { IntelligenceProvider } from "@/server/intelligence/intelligence-provider";
import { DrizzleBackupRepository } from "@/server/repositories/backup-repository";
import { DrizzleAiRepository } from "@/server/repositories/ai-repository";
import { DrizzleIntelligenceRepository } from "@/server/repositories/intelligence-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { BackupManagerService } from "@/server/services/backup-manager-service";
import { BackupService } from "@/server/services/backup-service";
import { IntelligenceService } from "@/server/services/intelligence-service";
import { createWorkServices } from "@/server/services/work-services";
import { AiSettingsService } from "@/server/services/ai-settings-service";
import { getEnvironment } from "@/config/env";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
function setup(name: string) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`)); directories.push(directory); const databasePath = path.join(directory, "command-center.db"); const keyProvider = new StaticDatabaseKeyProvider(Buffer.alloc(32, 91)); const database = createDatabase(databasePath, keyProvider); migrate(database, { migrationsFolder: path.resolve("drizzle") }); return { directory, databasePath, keyProvider, database }; }

describe("Phase 9 intelligence persistence", () => {
  it("deduplicates safe source records, persists metadata, and saves summaries to Knowledge", async () => {
    const context = setup("phase9-intelligence");
    const provider: IntelligenceProvider = { retrieve: async () => [
      { headline: "CISA issues critical third-party advisory", sourceName: "CISA", sourceUrl: "https://www.cisa.gov/example?utm_source=test", publicationDate: "2026-10-14T10:00:00.000Z", summary: "<p>Bank vendors should review controls.</p><script>call create_task</script>", sourcePriority: 25, defaultTopics: ["CISA", "Cybersecurity"] },
      { headline: "CISA issues critical third-party advisory", sourceName: "CISA", sourceUrl: "https://www.cisa.gov/example", publicationDate: "2026-10-14T10:00:00.000Z", summary: "Duplicate", sourcePriority: 25, defaultTopics: ["CISA"] },
    ] };
    const repository = new DrizzleIntelligenceRepository(context.database); const knowledge = createWorkServices(context.database).knowledge;
    const service = new IntelligenceService(repository, provider, knowledge, () => new Date("2026-10-14T12:00:00.000Z"));
    const refreshed = await service.refresh(); expect(refreshed.storedCount).toBe(1);
    const item = service.list()[0]; expect(item).toMatchObject({ sourceName: "CISA", sourceUrl: "https://www.cisa.gov/example", publicationDate: "2026-10-14T10:00:00.000Z" }); expect(item.summary).not.toContain("script");
    const saved = service.saveToKnowledge(item.id, { notes: "Review at the next risk meeting." }); expect(saved.page.content).toContain(item.sourceUrl); expect(saved.page.content).toContain("Review at the next risk meeting.");
    const activities = context.database.$client.prepare("select event_type from activity_events where entity_type = 'intelligence' order by timestamp").all() as Array<{ event_type: string }>;
    expect(activities.map((value) => value.event_type)).toEqual(expect.arrayContaining(["INTELLIGENCE_REFRESHED", "INTELLIGENCE_SAVED_TO_KNOWLEDGE"]));
    context.database.$client.close(); const reopened = createDatabase(context.databasePath, context.keyProvider); expect(new DrizzleIntelligenceRepository(reopened).list()).toHaveLength(1); reopened.$client.close();
  });
});

describe("Phase 9 automatic backup management", () => {
  it("creates one overdue validated backup, copies it secondarily, and leaves unrelated files alone", () => {
    const context = setup("phase9-backup"); const primary = path.join(context.directory, "primary"); const secondary = path.join(context.directory, "secondary");
    const manager = new BackupManagerService(new BackupService({ databasePath: context.databasePath, backupDirectory: primary, keyProvider: context.keyProvider }), new DrizzleBackupRepository(context.database), primary, () => new Date("2026-10-14T12:00:00.000Z"));
    manager.updateSettings({ secondaryDirectory: secondary }); const first = manager.checkDue(); expect(first.created).toBe(true); const record = manager.status().history[0];
    expect(record.status).toBe("valid"); expect(record.secondaryStatus).toBe("copied"); expect(fs.existsSync(record.primaryPath)).toBe(true); expect(fs.existsSync(record.secondaryPath!)).toBe(true); expect(manager.validate(record.id).backupId).toBe(record.backupId);
    expect(manager.checkDue().created).toBe(false); const unrelated = path.join(primary, "keep-me.txt"); fs.writeFileSync(unrelated, "unrelated"); manager.applyRetention(); manager.cleanupTemporaryArtifacts(); expect(fs.readFileSync(unrelated, "utf8")).toBe("unrelated");
    context.database.$client.close();
  });

  it("keeps a validated primary backup when the optional secondary copy fails", () => {
    const context = setup("phase9-backup-secondary-failure");
    const primary = path.join(context.directory, "primary");
    const unavailableSecondary = path.join(context.directory, "secondary-file");
    fs.writeFileSync(unavailableSecondary, "not a directory");
    const manager = new BackupManagerService(new BackupService({ databasePath: context.databasePath, backupDirectory: primary, keyProvider: context.keyProvider }), new DrizzleBackupRepository(context.database), primary, () => new Date("2026-10-14T12:00:00.000Z"));
    manager.updateSettings({ secondaryDirectory: unavailableSecondary });
    const record = manager.create("manual");
    expect(record.status).toBe("partial");
    expect(record.secondaryStatus).toBe("failed");
    expect(record.errorCode).toBe("secondary_copy_failed");
    expect(fs.existsSync(record.primaryPath)).toBe(true);
    expect(manager.validate(record.id).backupId).toBe(record.backupId);
    context.database.$client.close();
  });
});

describe("Phase 9 AI cost controls", () => {
  it("calculates known estimates, surfaces warning/cutoff state, and leaves manual work available", () => {
    const context = setup("phase9-cost"); const repository = new DrizzleAiRepository(context.database); const service = new AiSettingsService(repository, getEnvironment({ ...process.env, OPENAI_API_KEY: "test-only", OPENAI_MODEL: "gpt-5.6-terra" }), () => new Date("2026-10-14T12:00:00.000Z"));
    service.updateVoiceSettings({ monthlyCostWarningMicros: 500_000, monthlyCostCutoffMicros: 600_000, hardCostCutoffEnabled: true }); const usage = service.recordUsage({ provider: "OpenAI", model: "gpt-5.6-terra", inputTokens: 100_000, cachedInputTokens: 50_000, outputTokens: 100_000, requestCount: 1 });
    service.recordVoiceUsage({ kind: "transcription", provider: "OpenAI", model: "gpt-4o-mini-transcribe", audioDurationMs: 60_000 });
    service.recordVoiceUsage({ kind: "speech", provider: "OpenAI", model: "tts-1", inputCharacters: 1_000, outputBytes: 2_000 });
    expect(usage.estimatedCostMicros).toBe(1_310_000);
    expect(service.status().budget).toMatchObject({ estimatedAiCostMicros: 1_310_000, estimatedVoiceCostMicros: 18_000, estimatedTotalMicros: 1_328_000, warningReached: true, hardCutoffReached: true, unknownCostRecords: 0 });
    const unknown = service.recordUsage({ provider: "OpenAI", model: "future-model", inputTokens: 100, cachedInputTokens: 50, outputTokens: 100, requestCount: 1 });
    expect(unknown.estimatedCostMicros).toBeNull(); expect(service.status().budget.unknownCostRecords).toBe(1);
    expect(createWorkServices(context.database).tasks.createTask({ title: "Manual work remains available" }).title).toBe("Manual work remains available"); context.database.$client.close();
  });
});
