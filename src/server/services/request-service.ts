import { randomUUID } from "node:crypto";
import { calendarToday, isDueSoon, isFollowUpNeeded, isRequestOverdue } from "@/domain/work";
import type { NewActivityEvent, NewWorkRequest, WorkRequest } from "@/server/db/schema";
import type { ActivityEventRepository } from "@/server/repositories/activity-event-repository";
import type { PersonRepository } from "@/server/repositories/person-repository";
import type { ProjectRepository } from "@/server/repositories/project-repository";
import type { RequestListFilters, RequestRepository } from "@/server/repositories/request-repository";
import type { TaskRepository } from "@/server/repositories/task-repository";
import type { MeetingRepository } from "@/server/repositories/meeting-repository";
import { NotFoundError, ValidationError } from "./service-errors";
import { idSchema, requestCreateSchema, requestUpdateSchema } from "./work-validation";

export type RequestView = WorkRequest & { personName: string; projectName: string | null; relatedTaskTitle: string | null; overdue: boolean; followUpNeeded: boolean; dueSoon: boolean; waitingDays: number };

export class RequestService {
  constructor(
    private readonly repository: RequestRepository,
    private readonly people: PersonRepository,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly activity: ActivityEventRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly meetings?: MeetingRepository,
  ) {}
  createRequest(input: unknown): RequestView {
    const parsed = requestCreateSchema.parse(input); this.assertRelations(parsed);
    const { source, ...values } = parsed; const now = this.now(); const timestamp = now.toISOString(); const today = calendarToday(now);
    if (parsed.status !== "received" && parsed.receivedDate) throw new ValidationError("A received date requires Received status.");
    if (parsed.status !== "closed" && parsed.closedDate) throw new ValidationError("A closed date requires Closed status.");
    const request: NewWorkRequest = { ...values, id: randomUUID(), receivedDate: parsed.status === "received" ? parsed.receivedDate ?? today : null, closedDate: parsed.status === "closed" ? parsed.closedDate ?? today : null, createdAt: timestamp, updatedAt: timestamp, archivedAt: null };
    return this.toView(this.repository.create(request, this.event("REQUEST_CREATED", request.id, `Created request “${request.title}”.`, source, { personId: request.requestedFromPersonId, projectId: request.projectId }, timestamp)));
  }
  getRequest(id: string) {
    idSchema.parse(id); const request = this.repository.findById(id); if (!request) throw new NotFoundError("Request not found.");
    return { ...this.toView(request), activity: this.activity.listByEntity("request", id) };
  }
  listRequests(filters: RequestListFilters = {}) { if (filters.personId) idSchema.parse(filters.personId); if (filters.projectId) idSchema.parse(filters.projectId); return this.repository.list(filters).map((item) => this.toView(item)); }
  updateRequest(id: string, input: unknown): RequestView {
    idSchema.parse(id); const existing = this.repository.findById(id); if (!existing) throw new NotFoundError("Request not found.");
    const parsed = requestUpdateSchema.parse(input); this.assertRelations(parsed); const { source, ...requested } = parsed;
    const nextStatus = requested.status ?? existing.status; const changes: Partial<NewWorkRequest> = { ...requested };
    if (nextStatus === "received" && existing.status !== "received") changes.receivedDate ??= this.today();
    if (nextStatus === "closed" && existing.status !== "closed") changes.closedDate ??= this.today();
    const changedFields = Object.keys(changes).filter((key) => changes[key as keyof NewWorkRequest] !== existing[key as keyof WorkRequest]);
    if (!changedFields.length) return this.toView(existing);
    const timestamp = this.now().toISOString(); changes.updatedAt = timestamp;
    const transitions: Partial<Record<WorkRequest["status"], string>> = { requested: "REQUEST_REQUESTED", acknowledged: "REQUEST_ACKNOWLEDGED", waiting: "REQUEST_WAITING", received: "REQUEST_RECEIVED", closed: "REQUEST_CLOSED" };
    const eventType = requested.status && requested.status !== existing.status ? transitions[requested.status] ?? "REQUEST_UPDATED" : "REQUEST_UPDATED";
    const updated = this.repository.update(id, changes, this.event(eventType, id, `${eventType === "REQUEST_RECEIVED" ? "Received" : eventType === "REQUEST_CLOSED" ? "Closed" : "Updated"} request “${existing.title}”.`, source, { changedFields }, timestamp));
    if (!updated) throw new NotFoundError("Request not found."); return this.toView(updated);
  }
  markRequested(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateRequest(id, { status: "requested", source }); }
  markAcknowledged(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateRequest(id, { status: "acknowledged", source }); }
  markWaiting(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateRequest(id, { status: "waiting", source }); }
  markReceived(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateRequest(id, { status: "received", source }); }
  closeRequest(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateRequest(id, { status: "closed", source }); }
  archiveRequest(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchive(id, this.now().toISOString(), "REQUEST_ARCHIVED", source); }
  restoreRequest(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchive(id, null, "REQUEST_RESTORED", source); }
  private setArchive(id: string, archivedAt: string | null, type: string, source: NewActivityEvent["source"]) {
    idSchema.parse(id); const existing = this.repository.findById(id); if (!existing) throw new NotFoundError("Request not found.");
    if (existing.archivedAt === archivedAt || (archivedAt && existing.archivedAt)) return this.toView(existing);
    const timestamp = this.now().toISOString(); const updated = this.repository.update(id, { archivedAt, updatedAt: timestamp }, this.event(type, id, `${archivedAt ? "Archived" : "Restored"} request “${existing.title}”.`, source, {}, timestamp));
    if (!updated) throw new NotFoundError("Request not found."); return this.toView(updated);
  }
  private assertRelations(input: { requestedFromPersonId?: string; projectId?: string | null; relatedTaskId?: string | null; meetingId?: string | null }) {
    if (input.requestedFromPersonId && !this.people.findById(input.requestedFromPersonId)) throw new ValidationError("The selected person does not exist.");
    if (input.projectId && !this.projects.findById(input.projectId)) throw new ValidationError("The selected project does not exist.");
    if (input.relatedTaskId && !this.tasks.findById(input.relatedTaskId)) throw new ValidationError("The related task does not exist.");
    if (input.meetingId && this.meetings && !this.meetings.findById(input.meetingId)) throw new ValidationError("The selected meeting does not exist.");
  }
  private toView(request: WorkRequest): RequestView {
    const person = this.people.findById(request.requestedFromPersonId); if (!person) throw new ValidationError("The request has an invalid person relationship.");
    const today = this.today(); const requested = new Date(`${request.requestedDate}T00:00:00.000Z`); const current = new Date(`${today}T00:00:00.000Z`);
    return { ...request, personName: person.displayName, projectName: request.projectId ? this.projects.findById(request.projectId)?.name ?? null : null, relatedTaskTitle: request.relatedTaskId ? this.tasks.findById(request.relatedTaskId)?.title ?? null : null, overdue: isRequestOverdue(request.dueDate, request.status, today), followUpNeeded: isFollowUpNeeded(request.followUpDate, request.status, today), dueSoon: isDueSoon(request.dueDate, request.status, today), waitingDays: Math.max(0, Math.floor((current.valueOf() - requested.valueOf()) / 86_400_000)) };
  }
  private today() { return calendarToday(this.now()); }
  private event(eventType: string, entityId: string, description: string, source: NewActivityEvent["source"], metadata: Record<string, unknown>, timestamp: string): NewActivityEvent { return { id: randomUUID(), eventType, description, entityType: "request", entityId, source, metadata, timestamp }; }
}
