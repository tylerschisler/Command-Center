import { projectCalendarEvents, type CalendarEvent } from "@/domain/work";
import type { MeetingRepository } from "@/server/repositories/meeting-repository";
import type { ProjectRepository } from "@/server/repositories/project-repository";
import type { RequestRepository } from "@/server/repositories/request-repository";
import type { TaskRepository } from "@/server/repositories/task-repository";

function localDate(instant: string) {
  const date = new Date(instant); const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`;
}

export class CalendarService {
  constructor(private readonly meetings: MeetingRepository, private readonly tasks: TaskRepository, private readonly projects: ProjectRepository, private readonly requests: RequestRepository) {}
  listEvents(start?: string, end?: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    for (const meeting of this.meetings.list()) events.push({ id: `meeting:${meeting.id}:meeting`, entityType: "meeting", entityId: meeting.id, title: meeting.title, kind: "meeting", date: localDate(meeting.startDateTime), dateTime: meeting.startDateTime });
    for (const task of this.tasks.list()) events.push(...projectCalendarEvents("task", task, { target: task.targetDate, due: task.dueDate }));
    for (const project of this.projects.list()) events.push(...projectCalendarEvents("project", project, { target: project.targetDate, due: project.dueDate }));
    for (const request of this.requests.list()) events.push(...projectCalendarEvents("request", request, { due: request.dueDate, follow_up: request.followUpDate }));
    return events.filter((event) => (!start || event.date >= start) && (!end || event.date <= end)).sort((a, b) => a.date.localeCompare(b.date) || (a.dateTime ?? "").localeCompare(b.dateTime ?? "") || a.title.localeCompare(b.title));
  }
}
