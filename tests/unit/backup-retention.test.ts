import { describe, expect, it } from "vitest";
import { retainedBackupIds } from "@/server/services/backup-manager-service";
import type { BackupRecord } from "@/server/db/schema";

function record(id: string, date: string, status: BackupRecord["status"] = "valid"): BackupRecord { return { id, backupId: `backup-${id}`, createdAt: `${date}T12:00:00.000Z`, completedAt: `${date}T12:01:00.000Z`, status, trigger: "automatic", fileName: `command-center-${id}.ccbackup`, primaryPath: `/safe/${id}`, secondaryPath: null, secondaryStatus: "not_configured", schemaVersion: 9, databaseBytes: 10, errorCode: null }; }

describe("backup tier retention", () => {
  it("keeps 14 daily, 8 older weekly, and 12 older monthly restore points", () => {
    const records: BackupRecord[] = []; const start = new Date("2026-10-14T12:00:00.000Z");
    for (let index = 0; index < 500; index += 1) { const date = new Date(start); date.setUTCDate(date.getUTCDate() - index); records.push(record(String(index), date.toISOString().slice(0, 10))); }
    const keep = retainedBackupIds(records);
    expect(keep.size).toBe(34); expect(keep.has("0")).toBe(true); expect(keep.has("13")).toBe(true);
  });
  it("never selects failed or failed-validation records for deletion eligibility", () => {
    const keep = retainedBackupIds([record("good", "2026-10-14"), record("bad", "2026-10-13", "failed_validation")]);
    expect(keep.has("good")).toBe(true); expect(keep.has("bad")).toBe(false);
  });
  it("does not let same-day manual backups consume older weekly tiers", () => {
    const records = [record("newest", "2026-10-14"), record("same-day", "2026-10-14")];
    for (let index = 1; index <= 500; index += 1) { const date = new Date("2026-10-14T12:00:00.000Z"); date.setUTCDate(date.getUTCDate() - index); records.push(record(`older-${index}`, date.toISOString().slice(0, 10))); }
    const keep = retainedBackupIds(records);
    expect(keep.has("newest")).toBe(true);
    expect(keep.has("same-day")).toBe(false);
    expect(keep.size).toBe(34);
  });
});
