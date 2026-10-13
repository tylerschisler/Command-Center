import { randomUUID } from "node:crypto";
import { calendarToday } from "@/domain/work";
import type { Meeting, NewActivityEvent, NewMeeting, NewMeetingDecision } from "@/server/db/schema";
import type { ActivityEventRepository } from "@/server/repositories/activity-event-repository";
import type { MeetingListFilters, MeetingRepository } from "@/server/repositories/meeting-repository";
import type { PersonRepository } from "@/server/repositories/person-repository";
import type { ProjectRepository } from "@/server/repositories/project-repository";
import type { RequestRepository } from "@/server/repositories/request-repository";
import type { TaskRepository } from "@/server/repositories/task-repository";
import type { RequestService } from "./request-service";
import type { TaskService } from "./task-service";
import { NotFoundError, ValidationError } from "./service-errors";
import { decisionCreateSchema, idSchema, meetingCreateSchema, meetingUpdateSchema } from "./work-validation";

export class MeetingService {
  constructor(
    private readonly repository: MeetingRepository,
    private readonly people: PersonRepository,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly requests: RequestRepository,
    private readonly taskService: TaskService,
    private readonly requestService: RequestService,
    private readonly activity: ActivityEventRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  createMeeting(input: unknown) {
    const parsed = meetingCreateSchema.parse(input); this.assertProject(parsed.projectId); parsed.participantIds.forEach((id) => this.assertPerson(id));
    const startDateTime = this.canonical(parsed.startDateTime); const endDateTime = this.canonical(parsed.endDateTime); this.assertTimes(startDateTime, endDateTime);
    const { source, participantIds, ...values } = parsed; const timestamp = this.now().toISOString(); const id = randomUUID();
    const meeting: NewMeeting = { ...values, id, startDateTime, endDateTime, createdAt: timestamp, updatedAt: timestamp, archivedAt: null };
    const participantEvents = participantIds.map((personId) => this.event("MEETING_PARTICIPANT_ADDED", id, `Added a participant to meeting “${meeting.title}”.`, source, { personId }, timestamp));
    return this.toView(this.repository.create(meeting, this.event("MEETING_CREATED", id, `Created meeting “${meeting.title}”.`, source, { projectId: meeting.projectId, participantCount: participantIds.length }, timestamp), participantIds, participantEvents));
  }
  getMeeting(id: string) { idSchema.parse(id); const meeting = this.repository.findById(id); if (!meeting) throw new NotFoundError("Meeting not found."); return this.toDetail(meeting); }
  listMeetings(filters: MeetingListFilters = {}) { if (filters.projectId) idSchema.parse(filters.projectId); if (filters.personId) idSchema.parse(filters.personId); return this.repository.list(filters).map((meeting) => this.toView(meeting)); }
  updateMeeting(id: string, input: unknown) {
    idSchema.parse(id); const existing = this.repository.findById(id); if (!existing) throw new NotFoundError("Meeting not found.");
    const parsed = meetingUpdateSchema.parse(input); const { source, ...requested } = parsed; if (requested.projectId !== undefined) this.assertProject(requested.projectId);
    const changes: Partial<NewMeeting> = { ...requested };
    if (requested.startDateTime) changes.startDateTime = this.canonical(requested.startDateTime);
    if (requested.endDateTime) changes.endDateTime = this.canonical(requested.endDateTime);
    this.assertTimes(changes.startDateTime ?? existing.startDateTime, changes.endDateTime ?? existing.endDateTime);
    const changedFields = Object.keys(changes).filter((key) => changes[key as keyof NewMeeting] !== existing[key as keyof Meeting]); if (!changedFields.length) return this.toView(existing);
    const timestamp = this.now().toISOString(); changes.updatedAt = timestamp;
    const eventType = requested.status === "in_progress" && existing.status !== "in_progress" ? "MEETING_STARTED"
      : requested.status === "completed" && existing.status !== "completed" ? "MEETING_COMPLETED"
        : requested.status === "cancelled" && existing.status !== "cancelled" ? "MEETING_CANCELLED"
          : changedFields.length === 1 && changedFields[0] === "notes" ? "MEETING_NOTE_UPDATED" : "MEETING_UPDATED";
    const updated = this.repository.update(id, changes, this.event(eventType, id, `${eventType === "MEETING_STARTED" ? "Started" : eventType === "MEETING_COMPLETED" ? "Completed" : eventType === "MEETING_CANCELLED" ? "Cancelled" : "Updated"} meeting “${existing.title}”.`, source, { changedFields }, timestamp));
    if (!updated) throw new NotFoundError("Meeting not found."); return this.toView(updated);
  }
  startMeeting(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateMeeting(id, { status: "in_progress", source }); }
  endMeeting(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateMeeting(id, { status: "completed", source }); }
  cancelMeeting(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateMeeting(id, { status: "cancelled", source }); }
  archiveMeeting(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchive(id, this.now().toISOString(), "MEETING_ARCHIVED", source); }
  restoreMeeting(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchive(id, null, "MEETING_RESTORED", source); }
  addParticipant(meetingId: string, personId: string, source: NewActivityEvent["source"] = "manual") {
    const meeting = this.requireMeeting(meetingId); idSchema.parse(personId); this.assertPerson(personId); const timestamp = this.now().toISOString();
    this.repository.addParticipant(meetingId, personId, timestamp, this.event("MEETING_PARTICIPANT_ADDED", meetingId, `Added a participant to meeting “${meeting.title}”.`, source, { personId }, timestamp)); return this.getMeeting(meetingId);
  }
  removeParticipant(meetingId: string, personId: string, source: NewActivityEvent["source"] = "manual") {
    const meeting = this.requireMeeting(meetingId); idSchema.parse(personId); const timestamp = this.now().toISOString();
    this.repository.removeParticipant(meetingId, personId, this.event("MEETING_PARTICIPANT_REMOVED", meetingId, `Removed a participant from meeting “${meeting.title}”.`, source, { personId }, timestamp)); return this.getMeeting(meetingId);
  }
  addDecision(meetingId: string, input: unknown) {
    const meeting = this.requireMeeting(meetingId); const parsed = decisionCreateSchema.parse(input); const timestamp = this.now().toISOString();
    const decision: NewMeetingDecision = { id: randomUUID(), meetingId, content: parsed.content, createdAt: timestamp };
    this.repository.addDecision(decision, this.event("MEETING_DECISION_ADDED", meetingId, `Recorded a decision for meeting “${meeting.title}”.`, parsed.source, { decisionId: decision.id }, timestamp)); return this.getMeeting(meetingId);
  }
  createMeetingTask(meetingId: string, input: unknown) {
    const meeting = this.requireMeeting(meetingId); const record = typeof input === "object" && input ? input as Record<string, unknown> : {};
    return this.taskService.createTask({ ...record, meetingId, projectId: record.projectId === undefined ? meeting.projectId : record.projectId, source: record.source ?? "manual" });
  }
  createMeetingRequest(meetingId: string, input: unknown) {
    const meeting = this.requireMeeting(meetingId); const record = typeof input === "object" && input ? input as Record<string, unknown> : {};
    return this.requestService.createRequest({ ...record, meetingId, projectId: record.projectId === undefined ? meeting.projectId : record.projectId, requestedDate: record.requestedDate ?? calendarToday(this.now()), source: record.source ?? "manual" });
  }
  private setArchive(id: string, archivedAt: string | null, eventType: string, source: NewActivityEvent["source"]) {
    const existing = this.requireMeeting(id); if (existing.archivedAt === archivedAt || (archivedAt && existing.archivedAt)) return this.toView(existing); const timestamp = this.now().toISOString();
    const updated = this.repository.update(id, { archivedAt, updatedAt: timestamp }, this.event(eventType, id, `${archivedAt ? "Archived" : "Restored"} meeting “${existing.title}”.`, source, {}, timestamp)); if (!updated) throw new NotFoundError("Meeting not found."); return this.toView(updated);
  }
  private toView(meeting: Meeting) { const participants = this.repository.listParticipantIds(meeting.id).map((id) => this.people.findById(id)).filter((person) => Boolean(person)); return { ...meeting, projectName: meeting.projectId ? this.projects.findById(meeting.projectId)?.name ?? null : null, participants }; }
  private toDetail(meeting: Meeting) { return { ...this.toView(meeting), decisions: this.repository.listDecisions(meeting.id), tasks: this.tasks.list({ meetingId: meeting.id }), requests: this.requests.list({ meetingId: meeting.id }), activity: this.activity.listByEntity("meeting", meeting.id) }; }
  private requireMeeting(id: string) { idSchema.parse(id); const meeting = this.repository.findById(id); if (!meeting) throw new NotFoundError("Meeting not found."); return meeting; }
  private assertProject(id: string | null | undefined) { if (id && !this.projects.findById(id)) throw new ValidationError("The selected project does not exist."); }
  private assertPerson(id: string) { if (!this.people.findById(id)) throw new ValidationError("The selected person does not exist."); }
  private canonical(value: string) { return new Date(value).toISOString(); }
  private assertTimes(start: string, end: string) { if (new Date(end).valueOf() < new Date(start).valueOf()) throw new ValidationError("Meeting end time cannot be before its start time."); }
  private event(eventType: string, entityId: string, description: string, source: NewActivityEvent["source"], metadata: Record<string, unknown>, timestamp: string): NewActivityEvent { return { id: randomUUID(), eventType, description, entityType: "meeting", entityId, source, metadata, timestamp }; }
}
