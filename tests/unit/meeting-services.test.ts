import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { projectCalendarEvents } from "@/domain/work";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleMeetingRepository } from "@/server/repositories/meeting-repository";
import { DrizzlePersonRepository } from "@/server/repositories/person-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleRequestRepository } from "@/server/repositories/request-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { MeetingService } from "@/server/services/meeting-service";
import { PersonService } from "@/server/services/person-service";
import { ProjectService } from "@/server/services/project-service";
import { RequestService } from "@/server/services/request-service";
import { TaskService } from "@/server/services/task-service";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-unit-")); directories.push(directory); const database = createDatabase(path.join(directory, "unit.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 63))); migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database); const peopleRepo = new DrizzlePersonRepository(database); const projectsRepo = new DrizzleProjectRepository(database); const tasksRepo = new DrizzleTaskRepository(database); const requestsRepo = new DrizzleRequestRepository(database); const meetingsRepo = new DrizzleMeetingRepository(database); const clock = () => new Date("2026-10-12T15:00:00.000Z");
  const tasks = new TaskService(tasksRepo, projectsRepo, clock, peopleRepo); const requests = new RequestService(requestsRepo, peopleRepo, projectsRepo, tasksRepo, activity, clock);
  return { database, activity, people: new PersonService(peopleRepo, tasksRepo, requestsRepo, projectsRepo, activity, clock, meetingsRepo), projects: new ProjectService(projectsRepo, tasksRepo, activity, clock), meetings: new MeetingService(meetingsRepo, peopleRepo, projectsRepo, tasksRepo, requestsRepo, tasks, requests, activity, clock) };
}

describe("MeetingService", () => {
  it("validates time and supports lifecycle, notes, participants, and decisions", () => {
    const app = setup(); const person = app.people.createPerson({ firstName: "Morgan", lastName: "Chen" }); const project = app.projects.createProject({ name: "Controls", status: "active" });
    expect(() => app.meetings.createMeeting({ title: "Invalid", startDateTime: "2026-10-12T15:00:00.000Z", endDateTime: "2026-10-12T14:00:00.000Z" })).toThrow();
    const meeting = app.meetings.createMeeting({ title: "Control review", startDateTime: "2026-10-12T15:00:00.000Z", endDateTime: "2026-10-12T16:00:00.000Z", projectId: project.id, participantIds: [person.id] });
    expect(meeting.participants.map((item) => item?.displayName)).toEqual(["Morgan Chen"]); expect(app.meetings.startMeeting(meeting.id).status).toBe("in_progress"); expect(app.meetings.updateMeeting(meeting.id, { notes: "Evidence reviewed." }).notes).toBe("Evidence reviewed.");
    expect(app.meetings.addDecision(meeting.id, { content: "Require quarterly evidence." }).decisions).toHaveLength(1); expect(app.meetings.removeParticipant(meeting.id, person.id).participants).toHaveLength(0); expect(app.meetings.addParticipant(meeting.id, person.id).participants).toHaveLength(1); expect(app.meetings.endMeeting(meeting.id).status).toBe("completed");
    expect(app.activity.listByEntity("meeting", meeting.id).map((event) => event.eventType)).toEqual(expect.arrayContaining(["MEETING_CREATED", "MEETING_STARTED", "MEETING_NOTE_UPDATED", "MEETING_DECISION_ADDED", "MEETING_PARTICIPANT_REMOVED", "MEETING_PARTICIPANT_ADDED", "MEETING_COMPLETED"])); app.database.$client.close();
  });
});

describe("calendar projection", () => {
  it("creates distinct date-only target, due, and follow-up events", () => {
    expect(projectCalendarEvents("task", { id: "task-1", title: "Review" }, { target: "2026-10-12", due: "2026-10-14" })).toEqual([
      expect.objectContaining({ kind: "target", date: "2026-10-12", entityType: "task" }), expect.objectContaining({ kind: "due", date: "2026-10-14", entityType: "task" }),
    ]);
    expect(projectCalendarEvents("request", { id: "request-1", title: "Evidence" }, { follow_up: "2026-10-13" })[0]).toMatchObject({ kind: "follow_up", date: "2026-10-13" });
  });
});
