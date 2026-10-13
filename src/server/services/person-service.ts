import { randomUUID } from "node:crypto";
import type { NewActivityEvent, NewPerson, Person } from "@/server/db/schema";
import type { ActivityEventRepository } from "@/server/repositories/activity-event-repository";
import type { PersonRepository } from "@/server/repositories/person-repository";
import type { ProjectRepository } from "@/server/repositories/project-repository";
import type { RequestRepository } from "@/server/repositories/request-repository";
import type { TaskRepository } from "@/server/repositories/task-repository";
import { NotFoundError } from "./service-errors";
import { idSchema, personCreateSchema, personUpdateSchema } from "./work-validation";

export interface PersonSummary extends Person { openTaskCount: number; openRequestCount: number; activeProjectCount: number }

export class PersonService {
  constructor(
    private readonly repository: PersonRepository,
    private readonly tasks: TaskRepository,
    private readonly requests: RequestRepository,
    private readonly projects: ProjectRepository,
    private readonly activity: ActivityEventRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  createPerson(input: unknown): PersonSummary {
    const parsed = personCreateSchema.parse(input);
    const { source, ...values } = parsed;
    const timestamp = this.now().toISOString();
    const displayName = values.displayName || `${values.firstName} ${values.lastName}`;
    const person: NewPerson = { ...values, displayName, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp, archivedAt: null };
    return this.toSummary(this.repository.create(person, this.event("PERSON_CREATED", person.id, `Created person “${displayName}”.`, source, {}, timestamp)));
  }
  getPerson(id: string) {
    idSchema.parse(id);
    const person = this.repository.findById(id);
    if (!person) throw new NotFoundError("Person not found.");
    const tasks = this.tasks.list({ personId: id });
    const requests = this.requests.list({ personId: id });
    const projectIds = new Set([...tasks.map((item) => item.projectId), ...requests.map((item) => item.projectId)].filter((value): value is string => Boolean(value)));
    return {
      ...this.toSummary(person), tasks, requests,
      projects: this.projects.list().filter((project) => projectIds.has(project.id)),
      activity: this.activity.listByEntity("person", id),
    };
  }
  listPeople(archived = false) { return this.repository.list(archived).map((person) => this.toSummary(person)); }
  updatePerson(id: string, input: unknown): PersonSummary {
    idSchema.parse(id);
    const existing = this.repository.findById(id);
    if (!existing) throw new NotFoundError("Person not found.");
    const parsed = personUpdateSchema.parse(input);
    const { source, ...requested } = parsed;
    const changes: Partial<NewPerson> = { ...requested };
    if ((requested.firstName !== undefined || requested.lastName !== undefined) && requested.displayName === undefined) {
      changes.displayName = `${requested.firstName ?? existing.firstName} ${requested.lastName ?? existing.lastName}`;
    }
    const changedFields = Object.keys(changes).filter((key) => changes[key as keyof NewPerson] !== existing[key as keyof Person]);
    if (!changedFields.length) return this.toSummary(existing);
    const timestamp = this.now().toISOString(); changes.updatedAt = timestamp;
    const updated = this.repository.update(id, changes, this.event("PERSON_UPDATED", id, `Updated person “${existing.displayName}”.`, source, { changedFields }, timestamp));
    if (!updated) throw new NotFoundError("Person not found.");
    return this.toSummary(updated);
  }
  archivePerson(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchive(id, this.now().toISOString(), "PERSON_ARCHIVED", source); }
  restorePerson(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchive(id, null, "PERSON_RESTORED", source); }
  private setArchive(id: string, archivedAt: string | null, type: string, source: NewActivityEvent["source"]) {
    idSchema.parse(id); const existing = this.repository.findById(id); if (!existing) throw new NotFoundError("Person not found.");
    if (existing.archivedAt === archivedAt || (archivedAt && existing.archivedAt)) return this.toSummary(existing);
    const timestamp = this.now().toISOString();
    const updated = this.repository.update(id, { archivedAt, updatedAt: timestamp }, this.event(type, id, `${archivedAt ? "Archived" : "Restored"} person “${existing.displayName}”.`, source, {}, timestamp));
    if (!updated) throw new NotFoundError("Person not found."); return this.toSummary(updated);
  }
  private toSummary(person: Person): PersonSummary {
    const personTasks = this.tasks.list({ personId: person.id });
    const personRequests = this.requests.list({ personId: person.id });
    const projectIds = new Set([...personTasks.map((item) => item.projectId), ...personRequests.map((item) => item.projectId)].filter(Boolean));
    return {
      ...person,
      openTaskCount: personTasks.filter((item) => item.status !== "completed").length,
      openRequestCount: personRequests.filter((item) => item.status !== "received" && item.status !== "closed").length,
      activeProjectCount: this.projects.list().filter((item) => projectIds.has(item.id) && !["completed", "cancelled"].includes(item.status)).length,
    };
  }
  private event(eventType: string, entityId: string, description: string, source: NewActivityEvent["source"], metadata: Record<string, unknown>, timestamp: string): NewActivityEvent {
    return { id: randomUUID(), eventType, description, entityType: "person", entityId, source, metadata, timestamp };
  }
}
