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
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { KnowledgeService } from "@/server/services/knowledge-service";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase5-unit-")); directories.push(directory);
  const database = createDatabase(path.join(directory, "unit.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 51))); migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database); const repository = new DrizzleKnowledgeRepository(database);
  return { database, activity, repository, service: new KnowledgeService(repository, new DrizzleProjectRepository(database), new DrizzlePersonRepository(database), new DrizzleMeetingRepository(database), activity, () => new Date("2026-10-13T12:00:00.000Z")) };
}

describe("KnowledgeService", () => {
  it("creates, updates, archives, restores, and versions pages explicitly", () => {
    const app = setup(); const page = app.service.createPage({ title: "Galileo", content: "# Overview\nInitial", summary: "Application guide" });
    expect(page.versions).toHaveLength(1); expect(page.versions[0].content).toContain("Initial");
    const unchanged = app.service.updatePage(page.id, { title: "Galileo" }); expect(unchanged.versions).toHaveLength(1);
    const updated = app.service.updatePage(page.id, { content: "# Overview\nUpdated", changeDescription: "Expanded overview" }); expect(updated.versions).toHaveLength(2); expect(updated.versions.map((version) => version.changeDescription)).toContain("Expanded overview");
    const initialVersion = updated.versions.find((version) => version.content.includes("Initial")); expect(initialVersion).toBeDefined(); const restoredVersion = app.service.restoreVersion(page.id, { versionId: initialVersion!.id, changeDescription: "Restore initial" }); expect(restoredVersion.content).toContain("Initial"); expect(restoredVersion.versions).toHaveLength(3);
    expect(app.service.archivePage(page.id).archivedAt).not.toBeNull(); expect(app.service.listPages()).toHaveLength(0); expect(app.service.listPages({ archived: true })).toHaveLength(1); expect(app.service.restorePage(page.id).archivedAt).toBeNull();
    expect(app.activity.listByEntity("knowledge_page", page.id).map((event) => event.eventType)).toEqual(expect.arrayContaining(["KNOWLEDGE_PAGE_CREATED", "KNOWLEDGE_PAGE_UPDATED", "KNOWLEDGE_VERSION_RESTORED", "KNOWLEDGE_PAGE_ARCHIVED", "KNOWLEDGE_PAGE_RESTORED"])); app.database.$client.close();
  });

  it("supports multi-topic membership, normalized tags, relationships, and local search", () => {
    const app = setup(); const page = app.service.createPage({ title: "Galileo", content: "Privileged access review procedure", summary: "UAR application" }); const related = app.service.createPage({ title: "Privileged Access", content: "Controls" });
    const applications = app.service.createTopic({ name: "Applications" }); const uar = app.service.createTopic({ name: "User Access Reviews" }); app.service.assignTopic(page.id, applications.id); app.service.assignTopic(page.id, uar.id);
    const tag = app.service.createTag({ name: "  Access   Control " }); const duplicate = app.service.createTag({ name: "access control" }); expect(duplicate.id).toBe(tag.id); app.service.assignTag(page.id, tag.id);
    app.service.addRelationship(page.id, { targetType: "knowledge_page", targetId: related.id, relationshipType: "supports" });
    expect(app.service.getPage(page.id).topics).toHaveLength(2); expect(app.service.listPages({ topicId: applications.id })).toHaveLength(1); expect(app.service.listPages({ topicId: uar.id })[0].id).toBe(page.id); expect(app.service.getPage(page.id).relationships[0]).toMatchObject({ targetLabel: "Privileged Access", relationshipType: "supports" });
    expect(app.service.listPages({ query: "privileged" }).map((item) => item.id)).toContain(page.id); expect(app.service.listPages({ query: "Applications" })[0].id).toBe(page.id); expect(app.service.listPages({ query: "access control" }).map((item) => item.id)).toContain(page.id);
    app.service.removeTopic(page.id, applications.id); app.service.removeTag(page.id, tag.id); expect(app.service.getPage(page.id).topics).toHaveLength(1); expect(app.service.getPage(page.id).tags).toHaveLength(0); app.database.$client.close();
  });
});
