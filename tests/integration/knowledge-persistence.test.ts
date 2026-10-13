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
function services(databasePath: string, migrateFirst = false) {
  const database = createDatabase(databasePath, new StaticDatabaseKeyProvider(Buffer.alloc(32, 71))); if (migrateFirst) migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database); const peopleRepo = new DrizzlePersonRepository(database); const projectsRepo = new DrizzleProjectRepository(database); const tasksRepo = new DrizzleTaskRepository(database); const requestsRepo = new DrizzleRequestRepository(database); const meetingsRepo = new DrizzleMeetingRepository(database); const knowledgeRepo = new DrizzleKnowledgeRepository(database); const clock = () => new Date("2026-10-13T15:00:00.000Z");
  const tasks = new TaskService(tasksRepo, projectsRepo, clock, peopleRepo, meetingsRepo); const requests = new RequestService(requestsRepo, peopleRepo, projectsRepo, tasksRepo, activity, clock, meetingsRepo); const meetings = new MeetingService(meetingsRepo, peopleRepo, projectsRepo, tasksRepo, requestsRepo, tasks, requests, activity, clock);
  return { database, activity, people: new PersonService(peopleRepo, tasksRepo, requestsRepo, projectsRepo, activity, clock, meetingsRepo), projects: new ProjectService(projectsRepo, tasksRepo, activity, clock), meetings, knowledge: new KnowledgeService(knowledgeRepo, projectsRepo, peopleRepo, meetingsRepo, activity, clock) };
}

describe("Knowledge encrypted persistence", () => {
  it("persists topics, tags, versions, entity relationships, search, and activity across reopen", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase5-integration-")); directories.push(directory); const databasePath = path.join(directory, "phase5.db"); const first = services(databasePath, true);
    const person = first.people.createPerson({ firstName: "Sarah", lastName: "Lee" }); const project = first.projects.createProject({ name: "October UAR", status: "active" }); const meeting = first.meetings.createMeeting({ title: "Galileo review", startDateTime: "2026-10-13T15:00:00.000Z", endDateTime: "2026-10-13T16:00:00.000Z" });
    const page = first.knowledge.createPage({ title: "Galileo", content: "# UAR\nReview privileged accounts.", summary: "Application procedure" }); const related = first.knowledge.createPage({ title: "UAR Process", content: "General review process" });
    const topicA = first.knowledge.createTopic({ name: "Applications" }); const topicB = first.knowledge.createTopic({ name: "User Access Reviews" }); const tag = first.knowledge.createTag({ name: "Access Control" }); first.knowledge.assignTopic(page.id, topicA.id); first.knowledge.assignTopic(page.id, topicB.id); first.knowledge.assignTag(page.id, tag.id); first.knowledge.updatePage(page.id, { content: "# UAR\nReview privileged and service accounts.", changeDescription: "Added service accounts" });
    first.knowledge.addRelationship(page.id, { targetType: "project", targetId: project.id }); first.knowledge.addRelationship(page.id, { targetType: "person", targetId: person.id }); first.knowledge.addRelationship(page.id, { targetType: "meeting", targetId: meeting.id }); first.knowledge.addRelationship(page.id, { targetType: "knowledge_page", targetId: related.id });
    expect(first.knowledge.listForEntity("project", project.id)[0].id).toBe(page.id); expect(first.knowledge.listForEntity("person", person.id)[0].id).toBe(page.id); expect(first.knowledge.listForEntity("meeting", meeting.id)[0].id).toBe(page.id); expect(first.knowledge.listPages({ query: "service" })[0].id).toBe(page.id); expect(first.knowledge.listPages({ query: "User Access" })[0].id).toBe(page.id); expect(first.knowledge.listPages({ query: "Access Control" })[0].id).toBe(page.id); expect(first.activity.listByEntity("knowledge_page", page.id).length).toBeGreaterThanOrEqual(9); first.database.$client.close();
    const reopened = services(databasePath); const detail = reopened.knowledge.getPage(page.id); expect(detail).toMatchObject({ title: "Galileo", content: expect.stringContaining("service accounts") }); expect(detail.topics).toHaveLength(2); expect(detail.tags).toHaveLength(1); expect(detail.versions).toHaveLength(2); expect(detail.relationships).toHaveLength(4); expect(reopened.database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); expect(reopened.database.$client.pragma("foreign_key_check")).toEqual([]); reopened.database.$client.close();
  });
});
