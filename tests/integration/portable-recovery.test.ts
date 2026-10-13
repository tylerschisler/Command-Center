import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { generateRecoveryCredential } from "@/server/security/recovery-material";
import { ActivityService } from "@/server/services/activity-service";
import { BackupService } from "@/server/services/backup-service";
import { RecoveryService } from "@/server/services/recovery-service";

const tempDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  tempDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
});

describe("portable recovery", () => {
  it("recreates a lost Keychain key and restores a recovery-enabled backup", () => {
    const stdout = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "command-center-recovery-"));
    tempDirectories.push(directory);
    const databasePath = path.join(directory, "command-center.db");
    const recoveryMaterialPath = path.join(directory, "recovery.ccrecovery");
    const backupDirectory = path.join(directory, "backups");
    const keyStore = new StaticDatabaseKeyProvider(Buffer.alloc(32, 21));
    const recovery = new RecoveryService({
      databasePath,
      backupDirectory,
      recoveryMaterialPath,
      keyStore,
      kdfParameters: { N: 1 << 10, r: 8, p: 1 },
    });

    const database = createDatabase(databasePath, keyStore);
    migrate(database, { migrationsFolder: path.resolve("drizzle") });
    new ActivityService(new DrizzleActivityEventRepository(database)).record({
      eventType: "RECOVERY_TEST_CREATED",
      description: "known record survives portable recovery",
      entityType: "system",
      entityId: "portable-recovery-test",
      source: "system",
      metadata: {},
    });
    database.$client.close();

    const initialized = recovery.initializeRecovery();
    expect(initialized.credential).toMatch(/^CCREC1\.[A-Za-z0-9_-]{43}$/);
    expect(recovery.verifyCredential(initialized.credential)).toBe(true);
    expect(fs.readFileSync(recoveryMaterialPath, "utf8")).not.toContain(initialized.credential);

    const backup = new BackupService({ databasePath, backupDirectory, keyProvider: keyStore, recoveryMaterialPath })
      .createManualBackup();
    expect(fs.readFileSync(backup.backupPath).includes(Buffer.from(initialized.credential))).toBe(false);

    keyStore.deleteKey();
    expect(() => createDatabase(databasePath, keyStore)).toThrow("Unable to open the encrypted database");
    expect(() => recovery.verifyCredential(generateRecoveryCredential())).toThrow("recovery credential");

    recovery.restoreKeychain(initialized.credential);
    const recovered = createDatabase(databasePath, keyStore);
    expect(new ActivityService(new DrizzleActivityEventRepository(recovered))
      .forEntity("system", "portable-recovery-test")).toHaveLength(1);
    recovered.$client.close();

    keyStore.deleteKey();
    fs.rmSync(recoveryMaterialPath);
    const backupRecovery = recovery.restoreKeychainFromBackup(backup.backupPath, initialized.credential);
    expect(backupRecovery.backupId).toBe(backup.metadata.backupId);
    expect(fs.existsSync(recoveryMaterialPath)).toBe(true);

    const changed = createDatabase(databasePath, keyStore);
    new ActivityService(new DrizzleActivityEventRepository(changed)).record({
      eventType: "AFTER_RECOVERY_BACKUP",
      description: "must be removed by restore",
      entityType: "system",
      entityId: "after-recovery-backup",
      source: "system",
      metadata: {},
    });
    changed.$client.close();
    new BackupService({ databasePath, backupDirectory, keyProvider: keyStore, recoveryMaterialPath })
      .restoreBackup(backup.backupPath);

    const restored = createDatabase(databasePath, keyStore);
    const restoredActivity = new ActivityService(new DrizzleActivityEventRepository(restored));
    expect(restoredActivity.forEntity("system", "portable-recovery-test")).toHaveLength(1);
    expect(restoredActivity.forEntity("system", "after-recovery-backup")).toHaveLength(0);
    restored.$client.close();

    const rotated = recovery.rotateCredential(initialized.credential);
    expect(rotated.credential).not.toBe(initialized.credential);
    expect(() => recovery.verifyCredential(initialized.credential)).toThrow("recovery credential");
    expect(recovery.verifyCredential(rotated.credential)).toBe(true);

    const logs = [...stdout.mock.calls, ...stderr.mock.calls].flat().join(" ");
    expect(logs).not.toContain(initialized.credential);
    expect(logs).not.toContain(rotated.credential);
  });
});
