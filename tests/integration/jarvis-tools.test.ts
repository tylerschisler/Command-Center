import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { getEnvironment } from "@/config/env";
import { createDatabase } from "@/server/db/client";
import { DeterministicFakeAiProvider } from "@/server/ai/fake-ai-provider";
import { JarvisToolController } from "@/server/jarvis/tool-controller";
import { DrizzleAiRepository } from "@/server/repositories/ai-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { AiSettingsService } from "@/server/services/ai-settings-service";
import { JarvisService, JarvisUnavailableError } from "@/server/services/jarvis-service";
import { createWorkServices } from "@/server/services/work-services";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
function setup() { const directory = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-integration-")); directories.push(directory); const database = createDatabase(path.join(directory, "jarvis.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 73))); migrate(database, { migrationsFolder: path.resolve("drizzle") }); const settings = new AiSettingsService(new DrizzleAiRepository(database), getEnvironment({ ...process.env, OPENAI_API_KEY: "test-only", OPENAI_MODEL: "test-model" }), () => new Date("2026-10-13T12:00:00.000Z")); const services = createWorkServices(database); const tools = new JarvisToolController(services); return { database, settings, services, tools, jarvis: new JarvisService(new DeterministicFakeAiProvider(), tools, settings) }; }

describe("Jarvis service-mediated tools on encrypted SQLite", () => {
  it("defaults cloud AI off and never exposes an unknown or significant tool", async () => { const app = setup(); await expect(app.jarvis.run({ prompt: "create a task for the SOC report tomorrow", today: "2026-10-13", timeZone: "America/Chicago", pageContext: null })).rejects.toBeInstanceOf(JarvisUnavailableError); expect(app.tools.risk("delete_everything")).toBeNull(); expect((await app.tools.execute("delete_everything", {}, { today: "2026-10-13", timeZone: "America/Chicago", pageContext: null, source: "jarvis" })).ok).toBe(false); app.database.$client.close(); });
  it("creates grounded records through services, records activity and usage, and persists", async () => { const app = setup(); app.settings.setCloudAiEnabled(true); const result = await app.jarvis.run({ prompt: "create a task for the SOC report tomorrow", today: "2026-10-13", timeZone: "America/Chicago", pageContext: null }); const task = app.services.tasks.listTasks()[0]; expect(task).toMatchObject({ title: "Review the SOC report", dueDate: "2026-10-14" }); expect(result.response.actions[0].reference.entityId).toBe(task.id); expect(app.services.activity.forEntity("task", task.id)[0].source).toBe("jarvis"); expect(app.settings.status().usage.requests).toBe(1); expect(app.database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); app.database.$client.close(); });
  it("validates and routes Request, Meeting, Knowledge, and contextual Project writes", async () => { const app = setup(); const person = app.services.people.createPerson({ firstName: "Sarah", lastName: "Jones" }); const project = app.services.projects.createProject({ name: "Galileo" }); const request = app.services.requests.createRequest({ title: "User list", requestedFromPersonId: person.id, requestedDate: "2026-10-01", dueDate: "2026-10-15" }); const meeting = app.services.meetings.createMeeting({ title: "Review", startDateTime: "2026-10-14T15:00:00.000Z", endDateTime: "2026-10-14T16:00:00.000Z" }); const page = app.services.knowledge.createPage({ title: "Galileo", content: "Existing note." }); const context = { today: "2026-10-13", timeZone: "America/Chicago", pageContext: null, source: "jarvis" } as const;
    expect((await app.tools.execute("update_request", { id: request.id, status: "waiting" }, context)).ok).toBe(true);
    expect((await app.tools.execute("add_meeting_note", { id: meeting.id, note: "Discuss evidence." }, context)).ok).toBe(true);
    const knowledge = await app.tools.execute("update_knowledge_page", { id: page.id, appendContent: "Administrator users require a separate export.", changeDescription: "Admin requirement" }, context); expect(knowledge.ok).toBe(true); const updatedPage = app.services.knowledge.getPage(page.id); expect(updatedPage.content).toContain("Administrator users"); expect(updatedPage.versions[0].changeSource).toBe("jarvis");
    const contextual = await app.tools.execute("create_task", { title: "Follow up", dueDate: "tomorrow" }, { ...context, pageContext: { entityType: "project", entityId: project.id, label: project.name } }); expect(contextual.ok).toBe(true); expect(app.services.tasks.listTasks()[0].projectId).toBe(project.id);
    expect(app.services.activity.forEntity("request", request.id)[0].source).toBe("jarvis"); expect(app.services.activity.forEntity("meeting", meeting.id)[0].source).toBe("jarvis"); expect(app.services.activity.forEntity("knowledge_page", page.id)[0].source).toBe("jarvis"); app.database.$client.close(); });
});
