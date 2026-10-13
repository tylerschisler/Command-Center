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
import { RequestService } from "@/server/services/request-service";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase3-service-unit-")); directories.push(directory);
  const database = createDatabase(path.join(directory, "unit.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 36))); migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database); const peopleRepository = new DrizzlePersonRepository(database); const projects = new DrizzleProjectRepository(database); const tasks = new DrizzleTaskRepository(database); const requests = new DrizzleRequestRepository(database); const clock = () => new Date("2026-05-10T12:00:00.000Z");
  return { database, activity, people: new PersonService(peopleRepository, tasks, requests, projects, activity, clock), requests: new RequestService(requests, peopleRepository, projects, tasks, activity, clock) };
}

describe("PersonService", () => {
  it("creates, updates, archives, and restores people with atomic activity", () => {
    const app = setup(); const person = app.people.createPerson({ firstName: "Sam", lastName: "Rivera" }); expect(person.displayName).toBe("Sam Rivera");
    expect(app.people.updatePerson(person.id, { firstName: "Samantha" }).displayName).toBe("Samantha Rivera"); expect(app.people.archivePerson(person.id).archivedAt).not.toBeNull(); expect(app.people.restorePerson(person.id).archivedAt).toBeNull();
    expect(app.activity.listByEntity("person", person.id).map((event) => event.eventType)).toEqual(["PERSON_CREATED", "PERSON_UPDATED", "PERSON_ARCHIVED", "PERSON_RESTORED"]); app.database.$client.close();
  });
});

describe("RequestService", () => {
  it("applies lifecycle dates and preserves request history", () => {
    const app = setup(); const person = app.people.createPerson({ firstName: "Jordan", lastName: "Lee" }); const request = app.requests.createRequest({ title: "Send approval", requestedFromPersonId: person.id, requestedDate: "2026-05-01", dueDate: "2026-05-08" });
    expect(app.requests.markRequested(request.id).status).toBe("requested"); expect(app.requests.markAcknowledged(request.id).status).toBe("acknowledged"); expect(app.requests.markWaiting(request.id).status).toBe("waiting");
    const received = app.requests.markReceived(request.id); expect(received.receivedDate).toBe("2026-05-10"); expect(received.requestedDate).toBe("2026-05-01"); expect(app.requests.closeRequest(request.id).closedDate).toBe("2026-05-10");
    expect(app.activity.listByEntity("request", request.id).map((event) => event.eventType)).toEqual(["REQUEST_CREATED", "REQUEST_REQUESTED", "REQUEST_ACKNOWLEDGED", "REQUEST_WAITING", "REQUEST_RECEIVED", "REQUEST_CLOSED"]); app.database.$client.close();
  });
});
