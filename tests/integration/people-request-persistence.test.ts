import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzlePersonRepository } from "@/server/repositories/person-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleRequestRepository } from "@/server/repositories/request-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { PersonService } from "@/server/services/person-service";
import { ProjectService } from "@/server/services/project-service";
import { RequestService } from "@/server/services/request-service";
import { TaskService } from "@/server/services/task-service";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
const clock = () => new Date("2026-05-10T12:00:00.000Z");
function services(databasePath: string, migrateFirst = false) {
  const database = createDatabase(databasePath, new StaticDatabaseKeyProvider(Buffer.alloc(32, 73)));
  if (migrateFirst) migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database); const peopleRepo = new DrizzlePersonRepository(database); const projectRepo = new DrizzleProjectRepository(database); const taskRepo = new DrizzleTaskRepository(database); const requestRepo = new DrizzleRequestRepository(database);
  return { database, activity, people: new PersonService(peopleRepo, taskRepo, requestRepo, projectRepo, activity, clock), projects: new ProjectService(projectRepo, taskRepo, activity, clock), tasks: new TaskService(taskRepo, projectRepo, clock, peopleRepo), requests: new RequestService(requestRepo, peopleRepo, projectRepo, taskRepo, activity, clock) };
}

describe("People and Requests encrypted persistence", () => {
  it("persists relationships, lifecycle, counts, and activity across reopen", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "command-center-phase3-")); directories.push(directory); const databasePath = path.join(directory, "phase3.db");
    const first = services(databasePath, true); const person = first.people.createPerson({ firstName: "Avery", lastName: "Ng" }); const project = first.projects.createProject({ name: "Audit", status: "active" });
    const mine = first.tasks.createTask({ title: "Review evidence", projectId: project.id });
    const task = first.tasks.updateTask(mine.id, { ownerId: person.id });
    expect(task.ownerName).toBe("Avery Ng"); expect(first.tasks.listTasks({ ownership: "delegated" })).toHaveLength(1); expect(first.tasks.listTasks({ ownership: "mine" })).toHaveLength(0);
    const request = first.requests.createRequest({ title: "Provide evidence", requestedFromPersonId: person.id, status: "waiting", requestedDate: "2026-05-01", dueDate: "2026-05-09", followUpDate: "2026-05-10", projectId: project.id, relatedTaskId: task.id });
    expect(request).toMatchObject({ overdue: true, followUpNeeded: true, personName: "Avery Ng", projectName: "Audit" });
    expect(first.people.getPerson(person.id)).toMatchObject({ openTaskCount: 1, openRequestCount: 1, activeProjectCount: 1 });
    const received = first.requests.markReceived(request.id); expect(received.receivedDate).toBe("2026-05-10"); expect(received.overdue).toBe(false);
    expect(first.activity.listByEntity("request", request.id).map((event) => event.eventType)).toEqual(["REQUEST_CREATED", "REQUEST_RECEIVED"]);
    expect(first.activity.listByEntity("task", task.id).map((event) => event.eventType)).toEqual(["TASK_CREATED", "TASK_OWNER_CHANGED"]); first.database.$client.close();
    const reopened = services(databasePath); expect(reopened.people.getPerson(person.id).openRequestCount).toBe(0); expect(reopened.requests.getRequest(request.id).status).toBe("received"); expect(reopened.tasks.getTask(task.id).ownerName).toBe("Avery Ng"); reopened.database.$client.close();
  });
});
