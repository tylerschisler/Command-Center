import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { ActivityService } from "@/server/services/activity-service";
import { BackupService } from "@/server/services/backup-service";
import { ProjectService } from "@/server/services/project-service";
import { TaskService } from "@/server/services/task-service";

const tempDirectories: string[] = [];
afterEach(() => tempDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

describe("encrypted database backup and restore", () => {
  it("requires the key and restores known records without overwriting the current database", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "command-center-protection-"));
    tempDirectories.push(directory);
    const databasePath = path.join(directory, "command-center.db");
    const keyProvider = new StaticDatabaseKeyProvider(Buffer.alloc(32, 7));
    const wrongKeyProvider = new StaticDatabaseKeyProvider(Buffer.alloc(32, 8));

    const database = createDatabase(databasePath, keyProvider);
    migrate(database, { migrationsFolder: path.resolve("drizzle") });
    const activity = new ActivityService(new DrizzleActivityEventRepository(database));
    activity.record({
      eventType: "BACKUP_TEST_CREATED",
      description: "known record survives restoration",
      entityType: "system",
      entityId: "backup-test",
      source: "system",
      metadata: {},
    });
    const projectRepository = new DrizzleProjectRepository(database);
    const taskRepository = new DrizzleTaskRepository(database);
    const project = new ProjectService(projectRepository, taskRepository, new DrizzleActivityEventRepository(database))
      .createProject({ name: "Backup project", status: "active" });
    const task = new TaskService(taskRepository, projectRepository).createTask({ title: "Backup task", projectId: project.id });
    database.$client.close();

    expect(fs.readFileSync(databasePath).subarray(0, 16).toString("binary")).not.toBe("SQLite format 3\0");
    const unkeyed = new Database(databasePath);
    expect(() => unkeyed.prepare("select * from activity_events").all()).toThrow();
    unkeyed.close();
    expect(() => createDatabase(databasePath, wrongKeyProvider)).toThrow("Unable to open the encrypted database");

    const backupService = new BackupService({ databasePath, backupDirectory: path.join(directory, "backups"), keyProvider });
    const backup = backupService.createManualBackup();
    expect(fs.readFileSync(backup.backupPath).includes(Buffer.from("known record survives restoration"))).toBe(false);
    expect(backupService.validateBackup(backup.backupPath).backupId).toBe(backup.metadata.backupId);

    const changed = createDatabase(databasePath, keyProvider);
    new ActivityService(new DrizzleActivityEventRepository(changed)).record({
      eventType: "AFTER_BACKUP",
      description: "must not survive restore",
      entityType: "system",
      entityId: "after-backup",
      source: "system",
      metadata: {},
    });
    changed.$client.close();

    const restored = backupService.restoreBackup(backup.backupPath);
    expect(restored.protectedDatabasePath).not.toBeNull();
    expect(fs.existsSync(restored.protectedDatabasePath!)).toBe(true);
    const reopened = createDatabase(databasePath, keyProvider);
    const restoredActivity = new ActivityService(new DrizzleActivityEventRepository(reopened));
    expect(restoredActivity.forEntity("system", "backup-test")).toHaveLength(1);
    expect(restoredActivity.forEntity("system", "after-backup")).toHaveLength(0);
    expect(restoredActivity.forEntity("backup", backup.metadata.backupId)[0]?.eventType).toBe("BACKUP_RESTORED");
    expect(new TaskService(new DrizzleTaskRepository(reopened), new DrizzleProjectRepository(reopened)).getTask(task.id))
      .toMatchObject({ title: "Backup task", projectId: project.id });
    reopened.$client.close();
  });
});
