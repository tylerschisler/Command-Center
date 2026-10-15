import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, backupRecords, backupSettings, type BackupRecord, type BackupSettings, type NewActivityEvent, type NewBackupRecord } from "@/server/db/schema";

export interface BackupRepository {
  getSettings(now: string): BackupSettings;
  updateSettings(changes: Partial<Pick<BackupSettings, "automaticEnabled" | "secondaryDirectory">>, now: string): BackupSettings;
  list(): BackupRecord[];
  findById(id: string): BackupRecord | undefined;
  create(record: NewBackupRecord, event: NewActivityEvent): BackupRecord;
  update(id: string, changes: Partial<NewBackupRecord>): BackupRecord | undefined;
  removeRecord(id: string): void;
}

export class DrizzleBackupRepository implements BackupRepository {
  constructor(private readonly database: AppDatabase) {}
  getSettings(now: string) { return this.database.select().from(backupSettings).where(eq(backupSettings.id, "default")).get() ?? this.database.insert(backupSettings).values({ id: "default", automaticEnabled: true, secondaryDirectory: null, updatedAt: now }).returning().get(); }
  updateSettings(changes: Partial<Pick<BackupSettings, "automaticEnabled" | "secondaryDirectory">>, now: string) { this.getSettings(now); return this.database.update(backupSettings).set({ ...changes, updatedAt: now }).where(eq(backupSettings.id, "default")).returning().get(); }
  list() { return this.database.select().from(backupRecords).orderBy(desc(backupRecords.createdAt)).all(); }
  findById(id: string) { return this.database.select().from(backupRecords).where(eq(backupRecords.id, id)).get(); }
  create(record: NewBackupRecord, event: NewActivityEvent) { return this.database.transaction((tx) => { const created = tx.insert(backupRecords).values(record).returning().get(); tx.insert(activityEvents).values(event).run(); return created; }); }
  update(id: string, changes: Partial<NewBackupRecord>) { return this.database.update(backupRecords).set(changes).where(eq(backupRecords.id, id)).returning().get(); }
  removeRecord(id: string) { this.database.delete(backupRecords).where(eq(backupRecords.id, id)).run(); }
}
