import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleMeetingRepository } from "@/server/repositories/meeting-repository";
import { DrizzlePersonRepository } from "@/server/repositories/person-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleRequestRepository } from "@/server/repositories/request-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { CalendarService } from "@/server/services/calendar-service";
import { MeetingService } from "@/server/services/meeting-service";
import { PersonService } from "@/server/services/person-service";
import { ProjectService } from "@/server/services/project-service";
import { RequestService } from "@/server/services/request-service";
import { TaskService } from "@/server/services/task-service";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
function services(databasePath: string, migrateFirst = false) {
  const database = createDatabase(databasePath, new StaticDatabaseKeyProvider(Buffer.alloc(32, 82))); if (migrateFirst) migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const activity = new DrizzleActivityEventRepository(database); const peopleRepo = new DrizzlePersonRepository(database); const projectsRepo = new DrizzleProjectRepository(database); const tasksRepo = new DrizzleTaskRepository(database); const requestsRepo = new DrizzleRequestRepository(database); const meetingsRepo = new DrizzleMeetingRepository(database); const clock = () => new Date("2026-10-12T15:00:00.000Z");
  const tasks = new TaskService(tasksRepo, projectsRepo, clock, peopleRepo); const requests = new RequestService(requestsRepo, peopleRepo, projectsRepo, tasksRepo, activity, clock); const meetings = new MeetingService(meetingsRepo, peopleRepo, projectsRepo, tasksRepo, requestsRepo, tasks, requests, activity, clock);
  return { database, activity, people: new PersonService(peopleRepo, tasksRepo, requestsRepo, projectsRepo, activity, clock, meetingsRepo), projects: new ProjectService(projectsRepo, tasksRepo, activity, clock), meetings, calendar: new CalendarService(meetingsRepo, tasksRepo, projectsRepo, requestsRepo) };
}

describe("Meeting and Calendar encrypted persistence", () => {
  it("persists all relationships and projects every calendar source after reopen", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-integration-")); directories.push(directory); const databasePath = path.join(directory, "phase4.db"); const first = services(databasePath, true);
    const person = first.people.createPerson({ firstName: "Riley", lastName: "Patel" }); const project = first.projects.createProject({ name: "Access review", status: "active", targetDate: "2026-10-15", dueDate: "2026-10-20" });
    const meeting = first.meetings.createMeeting({ title: "UAR working session", startDateTime: "2026-10-12T15:00:00.000Z", endDateTime: "2026-10-12T16:00:00.000Z", projectId: project.id, participantIds: [person.id], agenda: "Review exceptions" });
    first.meetings.startMeeting(meeting.id); first.meetings.updateMeeting(meeting.id, { notes: "Reviewed all exceptions." }); first.meetings.addDecision(meeting.id, { content: "Escalate two exceptions." });
    const task = first.meetings.createMeetingTask(meeting.id, { title: "Document exceptions", ownerId: person.id, targetDate: "2026-10-13", dueDate: "2026-10-14" }); const request = first.meetings.createMeetingRequest(meeting.id, { title: "Send approval", requestedFromPersonId: person.id, dueDate: "2026-10-16", followUpDate: "2026-10-15", status: "requested" }); first.meetings.endMeeting(meeting.id);
    const detail = first.meetings.getMeeting(meeting.id); expect(detail).toMatchObject({ projectId: project.id, status: "completed", notes: "Reviewed all exceptions." }); expect(detail.participants).toHaveLength(1); expect(detail.decisions).toHaveLength(1); expect(detail.tasks[0]).toMatchObject({ id: task.id, meetingId: meeting.id, projectId: project.id }); expect(detail.requests[0]).toMatchObject({ id: request.id, meetingId: meeting.id, projectId: project.id });
    expect(first.people.getPerson(person.id).meetings).toHaveLength(1); const kinds = first.calendar.listEvents().map((event) => `${event.entityType}:${event.kind}`); expect(kinds).toEqual(expect.arrayContaining(["meeting:meeting", "task:target", "task:due", "project:target", "project:due", "request:due", "request:follow_up"])); expect(first.activity.listByEntity("meeting", meeting.id).length).toBeGreaterThanOrEqual(6); first.database.$client.close();
    const reopened = services(databasePath); expect(reopened.meetings.getMeeting(meeting.id)).toMatchObject({ title: "UAR working session", status: "completed" }); expect(reopened.meetings.getMeeting(meeting.id).tasks).toHaveLength(1); expect(reopened.meetings.getMeeting(meeting.id).requests).toHaveLength(1); expect(reopened.calendar.listEvents()).toHaveLength(7); expect(reopened.database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); reopened.database.$client.close();
  });
});
