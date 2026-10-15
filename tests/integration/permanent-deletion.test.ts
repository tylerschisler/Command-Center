import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleKnowledgeRepository } from "@/server/repositories/knowledge-repository";
import { DrizzleMeetingRepository } from "@/server/repositories/meeting-repository";
import { DrizzlePersonRepository } from "@/server/repositories/person-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleRequestRepository } from "@/server/repositories/request-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { MeetingService } from "@/server/services/meeting-service";
import { PersonService } from "@/server/services/person-service";
import { ProjectService } from "@/server/services/project-service";
import { RequestService } from "@/server/services/request-service";
import { TaskService } from "@/server/services/task-service";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "v11-delete-")); directories.push(directory);
  const database = createDatabase(path.join(directory, "delete.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 91)));
  migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database);
  const peopleRepo = new DrizzlePersonRepository(database), projectsRepo = new DrizzleProjectRepository(database), tasksRepo = new DrizzleTaskRepository(database), requestsRepo = new DrizzleRequestRepository(database), meetingsRepo = new DrizzleMeetingRepository(database), knowledgeRepo = new DrizzleKnowledgeRepository(database);
  const clock = () => new Date("2026-10-14T15:00:00.000Z");
  const tasks = new TaskService(tasksRepo, projectsRepo, clock, peopleRepo, meetingsRepo);
  const requests = new RequestService(requestsRepo, peopleRepo, projectsRepo, tasksRepo, activity, clock, meetingsRepo);
  const meetings = new MeetingService(meetingsRepo, peopleRepo, projectsRepo, tasksRepo, requestsRepo, tasks, requests, activity, clock);
  return { database, activity, tasks, requests, meetings, projects: new ProjectService(projectsRepo, tasksRepo, activity, clock), people: new PersonService(peopleRepo, tasksRepo, requestsRepo, projectsRepo, activity, clock, meetingsRepo), knowledge: new KnowledgeService(knowledgeRepo, projectsRepo, peopleRepo, meetingsRepo, activity, clock) };
}

describe("permanent deletion", () => {
  it("requires confirmation, blocks assigned people, preserves project work, and records events", () => {
    const app = setup();
    const person = app.people.createPerson({ firstName: "Ada", lastName: "Lovelace" });
    const project = app.projects.createProject({ name: "Control review", status: "active" });
    const meeting = app.meetings.createMeeting({ title: "Review", startDateTime: "2026-10-14T15:00:00.000Z", endDateTime: "2026-10-14T16:00:00.000Z", projectId: project.id });
    const task = app.tasks.createTask({ title: "Inspect evidence", ownerId: person.id, projectId: project.id, meetingId: meeting.id });
    const request = app.requests.createRequest({ title: "Send evidence", requestedFromPersonId: person.id, requestedDate: "2026-10-14", dueDate: "2026-10-15", projectId: project.id, relatedTaskId: task.id, meetingId: meeting.id });
    expect(() => app.tasks.deleteTask(task.id, "wrong")).toThrow(/DELETE/);
    expect(() => app.people.deletePerson(person.id, "DELETE")).toThrow(/Reassign/);
    expect(app.projects.deleteProject(project.id, "DELETE").impact).toEqual({ tasks: 1, requests: 1, meetings: 1, knowledgeRelationships: 0 });
    expect(app.tasks.getTask(task.id).projectId).toBeNull(); expect(app.requests.getRequest(request.id).projectId).toBeNull(); expect(app.meetings.getMeeting(meeting.id).projectId).toBeNull();
    expect(app.tasks.deleteTask(task.id, "DELETE").deleted).toBe(true);
    expect(app.requests.getRequest(request.id).relatedTaskId).toBeNull();
    app.requests.deleteRequest(request.id, "DELETE"); app.meetings.deleteMeeting(meeting.id, "DELETE");
    expect(app.people.deletePerson(person.id, "DELETE").deleted).toBe(true);
    expect(["PROJECT_DELETED", "TASK_DELETED", "REQUEST_DELETED", "MEETING_DELETED", "PERSON_DELETED"].every((type) => app.database.$client.prepare("select 1 from activity_events where event_type = ?").get(type))).toBe(true);
    app.database.$client.close();
  });

  it("transactionally removes knowledge versions, taxonomy links, relationships, and FTS content", () => {
    const app = setup();
    const page = app.knowledge.createPage({ title: "Sensitive runbook", content: "unique-deletion-token" });
    const related = app.knowledge.createPage({ title: "Related", content: "reference" });
    const topic = app.knowledge.createTopic({ name: "Controls" }); const tag = app.knowledge.createTag({ name: "Private" });
    app.knowledge.assignTopic(page.id, topic.id); app.knowledge.assignTag(page.id, tag.id); app.knowledge.addRelationship(page.id, { targetType: "knowledge_page", targetId: related.id }); app.knowledge.addRelationship(related.id, { targetType: "knowledge_page", targetId: page.id });
    expect(app.knowledge.deletePage(page.id, "DELETE").deleted).toBe(true);
    expect(app.database.$client.prepare("select count(*) as count from knowledge_versions where knowledge_page_id = ?").get(page.id)).toEqual({ count: 0 });
    expect(app.database.$client.prepare("select count(*) as count from knowledge_page_topics where knowledge_page_id = ?").get(page.id)).toEqual({ count: 0 });
    expect(app.database.$client.prepare("select count(*) as count from knowledge_page_tags where knowledge_page_id = ?").get(page.id)).toEqual({ count: 0 });
    expect(app.database.$client.prepare("select count(*) as count from entity_relationships where source_id = ? or target_id = ?").get(page.id, page.id)).toEqual({ count: 0 });
    expect(app.database.$client.prepare("select count(*) as count from knowledge_pages_fts where knowledge_pages_fts match ?").get('"unique-deletion-token"')).toEqual({ count: 0 });
    expect(app.activity.listByEntity("knowledge_page", page.id).at(-1)?.eventType).toBe("KNOWLEDGE_PAGE_DELETED");
    app.database.$client.close();
  });
});
