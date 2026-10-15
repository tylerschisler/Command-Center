import { randomUUID } from "node:crypto";
import { calculateProjectProgress, calendarToday, hasTargetAfterDueRisk, isOverdue } from "@/domain/work";
import type { NewActivityEvent, NewProject, Project } from "@/server/db/schema";
import type { ActivityEventRepository } from "@/server/repositories/activity-event-repository";
import type { ProjectListFilters, ProjectRepository } from "@/server/repositories/project-repository";
import type { TaskRepository } from "@/server/repositories/task-repository";
import { assertPermanentDeleteConfirmation, NotFoundError, ValidationError } from "./service-errors";
import { idSchema, projectCreateSchema, projectUpdateSchema } from "./work-validation";

export interface ProjectView extends Project {
  targetAfterDue: boolean;
  overdue: boolean;
  progress: ReturnType<typeof calculateProjectProgress>;
  overdueTaskCount: number;
}

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly activity: ActivityEventRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  createProject(input: unknown): ProjectView {
    const parsed = projectCreateSchema.parse(input);
    if (parsed.status !== "completed" && parsed.completedDate) throw new ValidationError("A completion date requires Completed status.");
    const { source, ...values } = parsed;
    const now = this.now();
    const timestamp = now.toISOString();
    const project: NewProject = {
      ...values,
      id: randomUUID(),
      completedDate: parsed.status === "completed" ? (parsed.completedDate ?? calendarToday(now)) : null,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    };
    const created = this.repository.create(project, this.event("PROJECT_CREATED", project.id, `Created project “${project.name}”.`, source, {
      priority: project.priority, status: project.status, health: project.health,
    }, timestamp));
    return this.toView(created);
  }

  getProject(id: string): ProjectView & { tasks: ReturnType<TaskRepository["list"]>; activity: ReturnType<ActivityEventRepository["listByEntity"]> } {
    idSchema.parse(id);
    const project = this.repository.findById(id);
    if (!project) throw new NotFoundError("Project not found.");
    return { ...this.toView(project), tasks: this.tasks.list({ projectId: id }), activity: this.activity.listByEntity("project", id) };
  }

  listProjects(filters: ProjectListFilters = {}): ProjectView[] {
    return this.repository.list(filters).map((project) => this.toView(project));
  }

  updateProject(id: string, input: unknown): ProjectView {
    idSchema.parse(id);
    const existing = this.repository.findById(id);
    if (!existing) throw new NotFoundError("Project not found.");
    const parsed = projectUpdateSchema.parse(input);
    const { source, ...requested } = parsed;
    const nextStatus = requested.status ?? existing.status;
    if (nextStatus !== "completed" && requested.completedDate) throw new ValidationError("A completion date requires Completed status.");
    const changes: Partial<NewProject> = { ...requested };
    if (nextStatus === "completed" && existing.status !== "completed") changes.completedDate ??= this.today();
    if (nextStatus !== "completed" && existing.status === "completed" && requested.completedDate === undefined) changes.completedDate = null;
    const changedFields = Object.keys(changes).filter((key) => changes[key as keyof NewProject] !== existing[key as keyof Project]);
    if (changedFields.length === 0) return this.toView(existing);
    const timestamp = this.now().toISOString();
    changes.updatedAt = timestamp;
    const eventType = nextStatus === "completed" && existing.status !== "completed"
      ? "PROJECT_COMPLETED"
      : existing.status === "completed" && nextStatus !== "completed" ? "PROJECT_REOPENED"
        : requested.health !== undefined && requested.health !== existing.health ? "PROJECT_HEALTH_CHANGED" : "PROJECT_UPDATED";
    const updated = this.repository.update(id, changes, this.event(eventType, id,
      eventType === "PROJECT_COMPLETED" ? `Completed project “${existing.name}”.` : `Updated project “${existing.name}”.`,
      source, { changedFields }, timestamp));
    if (!updated) throw new NotFoundError("Project not found.");
    return this.toView(updated);
  }

  completeProject(id: string, source: NewActivityEvent["source"] = "manual") { return this.updateProject(id, { status: "completed", source }); }
  archiveProject(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchive(id, this.now().toISOString(), "PROJECT_ARCHIVED", source); }
  restoreProject(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchive(id, null, "PROJECT_RESTORED", source); }
  deleteProject(id: string, confirmation: unknown, source: NewActivityEvent["source"] = "manual") {
    assertPermanentDeleteConfirmation(confirmation); idSchema.parse(id);
    if (!this.repository.findById(id)) throw new NotFoundError("Project not found.");
    const timestamp = this.now().toISOString();
    const impact = this.repository.delete(id, this.event("PROJECT_DELETED", id, "Permanently deleted a project and cleared its relationships.", source, {}, timestamp));
    if (!impact) throw new NotFoundError("Project not found.");
    return { deleted: true, id, impact };
  }

  private setArchive(id: string, archivedAt: string | null, eventType: string, source: NewActivityEvent["source"]): ProjectView {
    idSchema.parse(id);
    const existing = this.repository.findById(id);
    if (!existing) throw new NotFoundError("Project not found.");
    if (existing.archivedAt === archivedAt || (archivedAt !== null && existing.archivedAt)) return this.toView(existing);
    const timestamp = this.now().toISOString();
    const updated = this.repository.update(id, { archivedAt, updatedAt: timestamp }, this.event(
      eventType, id, `${archivedAt ? "Archived" : "Restored"} project “${existing.name}”.`, source, {}, timestamp,
    ));
    if (!updated) throw new NotFoundError("Project not found.");
    return this.toView(updated);
  }

  private toView(project: Project): ProjectView {
    const tasks = this.tasks.list({ projectId: project.id });
    return {
      ...project,
      targetAfterDue: hasTargetAfterDueRisk(project.targetDate, project.dueDate),
      overdue: isOverdue(project.dueDate, project.status, this.today()),
      progress: calculateProjectProgress(tasks),
      overdueTaskCount: tasks.filter((task) => isOverdue(task.dueDate, task.status, this.today())).length,
    };
  }
  private today() { return calendarToday(this.now()); }
  private event(eventType: string, entityId: string, description: string, source: NewActivityEvent["source"], metadata: Record<string, unknown>, timestamp: string): NewActivityEvent {
    return { id: randomUUID(), eventType, description, entityType: "project", entityId, source, metadata, timestamp };
  }
}
