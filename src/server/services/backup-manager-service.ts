import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { BackupRecord, NewActivityEvent } from "@/server/db/schema";
import type { BackupRepository } from "@/server/repositories/backup-repository";
import type { BackupService } from "./backup-service";
import { NotFoundError, ValidationError } from "./service-errors";

const DAY = 86_400_000;
const settingsSchema = z.object({ automaticEnabled: z.boolean().optional(), secondaryDirectory: z.string().trim().max(1_000).nullable().optional() }).refine((value) => Object.keys(value).length > 0);

function dayKey(date: Date) { return date.toISOString().slice(0, 10); }
function monthKey(date: Date) { return date.toISOString().slice(0, 7); }
function weekKey(date: Date) { const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7)); const start = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1)); return `${copy.getUTCFullYear()}-${String(Math.ceil((((copy.getTime() - start.getTime()) / DAY) + 1) / 7)).padStart(2, "0")}`; }

export function retainedBackupIds(records: BackupRecord[]) {
  const valid = records.filter((record) => record.status === "valid" || record.status === "partial").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const keep = new Set<string>(); const daily = new Set<string>(), weekly = new Set<string>(), monthly = new Set<string>();
  for (const record of valid) {
    const day = dayKey(new Date(record.createdAt));
    if (daily.size < 14 && !daily.has(day)) { daily.add(day); keep.add(record.id); }
  }
  for (const record of valid) {
    const date = new Date(record.createdAt); const day = dayKey(date), week = weekKey(date);
    if (daily.has(day) || weekly.has(week)) continue;
    weekly.add(week); keep.add(record.id);
    if (weekly.size === 8) break;
  }
  for (const record of valid) {
    const date = new Date(record.createdAt); const day = dayKey(date), week = weekKey(date), month = monthKey(date);
    if (daily.has(day) || weekly.has(week) || monthly.has(month)) continue;
    monthly.add(month); keep.add(record.id);
    if (monthly.size === 12) break;
  }
  if (valid[0]) keep.add(valid[0].id);
  return keep;
}

function inside(root: string, candidate: string) { const resolvedRoot = path.resolve(root); const resolved = path.resolve(candidate); return resolved.startsWith(`${resolvedRoot}${path.sep}`); }

export class BackupManagerService {
  constructor(private readonly core: BackupService, private readonly repository: BackupRepository, private readonly primaryDirectory: string, private readonly now = () => new Date()) {}
  status() {
    const now = this.now(); const settings = this.repository.getSettings(now.toISOString()); const history = this.repository.list(); const last = history.find((record) => record.status === "valid" || record.status === "partial") ?? null;
    const due = !last || now.getTime() - new Date(last.createdAt).getTime() >= DAY;
    return { settings, primaryDirectory: path.resolve(this.primaryDirectory), retention: { daily: 14, weekly: 8, monthly: 12 }, lastSuccessfulBackup: last, due, nextDueAt: last ? new Date(new Date(last.createdAt).getTime() + DAY).toISOString() : null, history: history.slice(0, 40) };
  }
  updateSettings(input: unknown) { const parsed = settingsSchema.parse(input); if (parsed.secondaryDirectory) this.assertSecondary(parsed.secondaryDirectory); this.repository.updateSettings(parsed, this.now().toISOString()); return this.status(); }
  checkDue() { const status = this.status(); return !status.settings.automaticEnabled || !status.due ? { created: false, status } : { created: true, result: this.create("automatic") }; }
  create(trigger: "automatic" | "manual" | "restore_point" = "manual") {
    const timestamp = this.now().toISOString(); const settings = this.repository.getSettings(timestamp); const id = randomUUID();
    try {
      const result = this.core.createManualBackup(); this.core.validateBackup(result.backupPath);
      let secondaryPath: string | null = null; let secondaryStatus: BackupRecord["secondaryStatus"] = "not_configured"; let status: BackupRecord["status"] = "valid"; let errorCode: string | null = null;
      if (settings.secondaryDirectory) {
        let temporary: string | null = null;
        try { this.assertSecondary(settings.secondaryDirectory); fs.mkdirSync(settings.secondaryDirectory, { recursive: true, mode: 0o700 }); secondaryPath = path.join(settings.secondaryDirectory, path.basename(result.backupPath)); temporary = `${secondaryPath}.${randomUUID()}.tmp`; fs.copyFileSync(result.backupPath, temporary, fs.constants.COPYFILE_EXCL); fs.renameSync(temporary, secondaryPath); temporary = null; secondaryStatus = "copied"; }
        catch { secondaryStatus = "failed"; status = "partial"; errorCode = "secondary_copy_failed"; }
        finally { if (temporary && fs.existsSync(temporary)) fs.rmSync(temporary); }
      }
      const record = this.repository.create({ id, backupId: result.metadata.backupId, createdAt: result.metadata.createdAt, completedAt: this.now().toISOString(), status, trigger, fileName: path.basename(result.backupPath), primaryPath: path.resolve(result.backupPath), secondaryPath, secondaryStatus, schemaVersion: result.metadata.schemaVersion, databaseBytes: result.metadata.databaseBytes, errorCode }, this.event("BACKUP_CREATED", id, status === "partial" ? "Created and validated an encrypted backup; the optional secondary copy failed." : "Created and validated an encrypted backup.", { trigger, backupId: result.metadata.backupId, secondaryStatus }, timestamp));
      this.applyRetention(); this.cleanupTemporaryArtifacts(); return record;
    } catch (error) {
      this.repository.create({ id, backupId: randomUUID(), createdAt: timestamp, completedAt: this.now().toISOString(), status: "failed", trigger, fileName: "unavailable", primaryPath: path.resolve(this.primaryDirectory), secondaryPath: null, secondaryStatus: "not_configured", schemaVersion: null, databaseBytes: null, errorCode: "backup_failed" }, this.event("BACKUP_FAILED", id, "An encrypted backup attempt failed.", { trigger, errorCode: "backup_failed" }, timestamp));
      throw error;
    }
  }
  validate(id: string) { const record = this.requireRecord(id); try { const metadata = this.core.validateBackup(record.primaryPath); this.repository.update(id, { status: record.secondaryStatus === "failed" ? "partial" : "valid", errorCode: record.secondaryStatus === "failed" ? "secondary_copy_failed" : null, schemaVersion: metadata.schemaVersion, databaseBytes: metadata.databaseBytes, completedAt: this.now().toISOString() }); return metadata; } catch (error) { this.repository.update(id, { status: "failed_validation", errorCode: "validation_failed", completedAt: this.now().toISOString() }); throw error; } }
  restore(id: string, confirmation: string) { if (confirmation !== "RESTORE") throw new ValidationError("Type RESTORE to confirm this destructive operation."); const record = this.requireRecord(id); this.core.validateBackup(record.primaryPath); return this.core.restoreBackup(record.primaryPath); }
  createRestorePoint() { return this.create("restore_point"); }
  applyRetention() {
    const records = this.repository.list(); const keep = retainedBackupIds(records);
    for (const record of records) {
      if (!(["valid", "partial"] as string[]).includes(record.status) || keep.has(record.id)) continue;
      if (!inside(this.primaryDirectory, record.primaryPath) || !/^command-center-.*\.ccbackup$/.test(record.fileName)) continue;
      if (fs.existsSync(record.primaryPath)) fs.rmSync(record.primaryPath);
      if (record.secondaryPath && this.repository.getSettings(this.now().toISOString()).secondaryDirectory && inside(this.repository.getSettings(this.now().toISOString()).secondaryDirectory!, record.secondaryPath) && fs.existsSync(record.secondaryPath)) fs.rmSync(record.secondaryPath);
      this.repository.removeRecord(record.id);
    }
  }
  cleanupTemporaryArtifacts() { if (!fs.existsSync(this.primaryDirectory)) return; const cutoff = this.now().getTime() - DAY; for (const entry of fs.readdirSync(this.primaryDirectory, { withFileTypes: true })) { const candidate = path.join(this.primaryDirectory, entry.name); if (entry.isFile() && entry.name.includes(".tmp") && inside(this.primaryDirectory, candidate) && fs.statSync(candidate).mtimeMs < cutoff) fs.rmSync(candidate); } }
  private requireRecord(id: string) { if (!z.string().uuid().safeParse(id).success) throw new ValidationError("A valid backup ID is required."); const record = this.repository.findById(id); if (!record) throw new NotFoundError("Backup record not found."); if (!inside(this.primaryDirectory, record.primaryPath)) throw new ValidationError("The backup is outside the managed primary directory."); return record; }
  private assertSecondary(value: string) { const resolved = path.resolve(value); if (resolved === path.parse(resolved).root) throw new ValidationError("A filesystem root cannot be used as a secondary backup folder."); if (resolved === path.resolve(this.primaryDirectory)) throw new ValidationError("The secondary folder must differ from the primary backup folder."); }
  private event(eventType: string, entityId: string, description: string, metadata: Record<string, unknown>, timestamp: string): NewActivityEvent { return { id: randomUUID(), eventType, description, entityType: "backup", entityId, source: "system", metadata, timestamp }; }
}
