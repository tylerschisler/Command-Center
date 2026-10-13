import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { ProjectService } from "@/server/services/project-service";
import { TaskService } from "@/server/services/task-service";

const tempDirectories: string[] = [];
afterEach(() => tempDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

function services(databasePath: string, keyProvider: StaticDatabaseKeyProvider, migrateFirst = false) {
  const database = createDatabase(databasePath, keyProvider);
  if (migrateFirst) migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database);
  const projects = new DrizzleProjectRepository(database);
  const tasks = new DrizzleTaskRepository(database);
  return { database, activity, projects: new ProjectService(projects, tasks, activity), tasks: new TaskService(tasks, projects) };
}

describe("Task and Project encrypted persistence", () => {
  it("migrates, relates records, logs mutations, and survives a reopened connection", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "command-center-phase2-")); tempDirectories.push(directory);
    const databasePath = path.join(directory, "phase2.db"); const keyProvider = new StaticDatabaseKeyProvider(Buffer.alloc(32, 44));
    const first = services(databasePath, keyProvider, true);
    const project = first.projects.createProject({ name: "Phase 2", status: "active", targetDate: "2026-06-20", dueDate: "2026-06-15" });
    const task = first.tasks.createTask({ title: "Persist work", projectId: project.id, targetDate: "2026-06-20", dueDate: "2026-06-15" });
    first.tasks.completeTask(task.id);
    expect(first.activity.listByEntity("project", project.id).map((event) => event.eventType)).toEqual(["PROJECT_CREATED"]);
    expect(first.activity.listByEntity("task", task.id).map((event) => event.eventType)).toEqual(expect.arrayContaining(["TASK_COMPLETED", "TASK_CREATED"]));
    expect(first.projects.getProject(project.id).progress.percent).toBe(100);
    first.database.$client.close();

    const reopened = services(databasePath, keyProvider);
    const persistedProject = reopened.projects.getProject(project.id);
    expect(persistedProject.tasks).toHaveLength(1);
    expect(persistedProject.tasks[0]).toMatchObject({ id: task.id, projectId: project.id, targetDate: "2026-06-20", dueDate: "2026-06-15", status: "completed" });
    expect(persistedProject.targetAfterDue).toBe(true);
    expect(reopened.tasks.getTask(task.id).title).toBe("Persist work");
    expect(reopened.activity.listByEntity("task", task.id)).toHaveLength(2);
    reopened.database.$client.close();
  });
});
