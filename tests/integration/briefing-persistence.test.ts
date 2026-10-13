import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleBriefingRepository, DrizzleCommandCenterRepository } from "@/server/repositories/command-center-repository";
import { DrizzleKnowledgeRepository } from "@/server/repositories/knowledge-repository";
import { DrizzleMeetingRepository } from "@/server/repositories/meeting-repository";
import { DrizzlePersonRepository } from "@/server/repositories/person-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleRequestRepository } from "@/server/repositories/request-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { BriefingService, CommandCenterService } from "@/server/services/briefing-service";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { MeetingService } from "@/server/services/meeting-service";
import { PersonService } from "@/server/services/person-service";
import { ProjectService } from "@/server/services/project-service";
import { RequestService } from "@/server/services/request-service";
import { TaskService } from "@/server/services/task-service";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
function setup(databasePath: string, migrateFirst = false) {
  const database = createDatabase(databasePath, new StaticDatabaseKeyProvider(Buffer.alloc(32, 91))); if (migrateFirst) migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database); const peopleRepo = new DrizzlePersonRepository(database); const projectsRepo = new DrizzleProjectRepository(database); const tasksRepo = new DrizzleTaskRepository(database); const requestsRepo = new DrizzleRequestRepository(database); const meetingsRepo = new DrizzleMeetingRepository(database); const knowledgeRepo = new DrizzleKnowledgeRepository(database); const dashboardRepo = new DrizzleCommandCenterRepository(database); const clock = () => new Date("2026-10-13T15:00:00.000Z");
  const tasks = new TaskService(tasksRepo, projectsRepo, clock, peopleRepo, meetingsRepo); const requests = new RequestService(requestsRepo, peopleRepo, projectsRepo, tasksRepo, activity, clock, meetingsRepo); const meetings = new MeetingService(meetingsRepo, peopleRepo, projectsRepo, tasksRepo, requestsRepo, tasks, requests, activity, clock);
  return { database, activity, tasks, requests, meetings, people: new PersonService(peopleRepo, tasksRepo, requestsRepo, projectsRepo, activity, clock, meetingsRepo), projects: new ProjectService(projectsRepo, tasksRepo, activity, clock), knowledge: new KnowledgeService(knowledgeRepo, projectsRepo, peopleRepo, meetingsRepo, activity, clock), home: new CommandCenterService(dashboardRepo), briefings: new BriefingService(dashboardRepo, new DrizzleBriefingRepository(database), clock) };
}

describe("encrypted Command Center and briefing persistence", () => {
  it("generates traceable facts, activity, and preserves them after reopen", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase6-integration-")); directories.push(directory); const databasePath = path.join(directory, "phase6.db"); const app = setup(databasePath, true);
    const person = app.people.createPerson({ firstName: "Sam", lastName: "Lee" }); const project = app.projects.createProject({ name: "October UAR", status: "active", health: "at_risk", dueDate: "2026-10-14" });
    const task = app.tasks.createTask({ title: "Review evidence", projectId: project.id, priority: "high", dueDate: "2026-10-12" }); const request = app.requests.createRequest({ title: "Provide evidence", requestedFromPersonId: person.id, requestedDate: "2026-10-01", dueDate: "2026-10-12", status: "waiting", projectId: project.id }); const meeting = app.meetings.createMeeting({ title: "Control review", startDateTime: "2026-10-13T16:00:00.000Z", endDateTime: "2026-10-13T17:00:00.000Z", participantIds: [person.id], projectId: project.id }); app.knowledge.createPage({ title: "Control Notes", content: "Evidence reviewed." });
    expect(app.home.getHome({ today: "2026-10-13", timeZone: "America/Chicago" }).summary).toMatchObject({ overdueTasks: 1, meetingsToday: 1, openRequests: 1, projectsAtRisk: 1 });
    app.tasks.completeTask(task.id); app.requests.markReceived(request.id); app.meetings.addDecision(meeting.id, { content: "Retain quarterly evidence." }); app.meetings.endMeeting(meeting.id);
    const briefing = app.briefings.generate("end_of_day", { today: "2026-10-13", timeZone: "America/Chicago" }); expect(briefing.renderedContent).toContain("Completed task"); expect(briefing.renderedContent).toContain("Retain quarterly evidence."); expect((briefing.structuredFacts as { history: { tasksCompleted: unknown[] } }).history.tasksCompleted).toHaveLength(1); expect(app.activity.listByEntity("briefing", briefing.id)[0].eventType).toBe("BRIEFING_GENERATED"); app.database.$client.close();
    const reopened = setup(databasePath); const persisted = reopened.briefings.getBriefing(briefing.id); expect(persisted.structuredFacts).toEqual(briefing.structuredFacts); expect(reopened.database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); expect(reopened.database.$client.pragma("foreign_key_check")).toEqual([]); reopened.database.$client.close();
  });
});
