import { randomUUID } from "node:crypto";
import { calendarToday, hasTargetAfterDueRisk, isOverdue } from "@/domain/work";
import type { NewActivityEvent, NewTask, Task } from "@/server/db/schema";
import type { ProjectRepository } from "@/server/repositories/project-repository";
import type { TaskListFilters, TaskRepository } from "@/server/repositories/task-repository";
import { NotFoundError, ValidationError } from "./service-errors";
import { idSchema, taskCreateSchema, taskUpdateSchema } from "./work-validation";

export type TaskView = Task & { targetAfterDue: boolean; overdue: boolean };

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly projects: ProjectRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  createTask(input: unknown): TaskView {
    const parsed = taskCreateSchema.parse(input);
    if (parsed.status !== "completed" && parsed.completedDate) throw new ValidationError("A completion date requires Completed status.");
    this.assertProject(parsed.projectId);
    const { source, ...values } = parsed;
    const now = this.now();
    const timestamp = now.toISOString();
    const task: NewTask = {
      ...values,
      id: randomUUID(),
      completedDate: parsed.status === "completed" ? (parsed.completedDate ?? calendarToday(now)) : null,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    };
    return this.toView(this.repository.create(task, this.event("TASK_CREATED", task.id, `Created task “${task.title}”.`, source, {
      projectId: task.projectId, priority: task.priority, status: task.status,
    }, timestamp)));
  }

  getTask(id: string): TaskView {
    idSchema.parse(id);
    const task = this.repository.findById(id);
    if (!task) throw new NotFoundError("Task not found.");
    return this.toView(task);
  }

  listTasks(filters: TaskListFilters = {}): TaskView[] {
    if (filters.projectId) idSchema.parse(filters.projectId);
    return this.repository.list(filters).map((task) => this.toView(task));
  }

  updateTask(id: string, input: unknown): TaskView {
    idSchema.parse(id);
    const existing = this.repository.findById(id);
    if (!existing) throw new NotFoundError("Task not found.");
    const parsed = taskUpdateSchema.parse(input);
    const { source, ...requested } = parsed;
    if (requested.projectId !== undefined) this.assertProject(requested.projectId);
    const nextStatus = requested.status ?? existing.status;
    if (nextStatus !== "completed" && requested.completedDate) throw new ValidationError("A completion date requires Completed status.");
    const changes: Partial<NewTask> = { ...requested };
    if (nextStatus === "completed" && existing.status !== "completed") changes.completedDate ??= this.today();
    if (nextStatus !== "completed" && existing.status === "completed" && requested.completedDate === undefined) changes.completedDate = null;
    const changedFields = Object.keys(changes).filter((key) => changes[key as keyof NewTask] !== existing[key as keyof Task]);
    if (changedFields.length === 0) return this.toView(existing);
    changes.updatedAt = this.now().toISOString();
    const eventType = nextStatus === "completed" && existing.status !== "completed"
      ? "TASK_COMPLETED"
      : existing.status === "completed" && nextStatus !== "completed" ? "TASK_REOPENED" : "TASK_UPDATED";
    const updated = this.repository.update(id, changes, this.event(eventType, id,
      eventType === "TASK_COMPLETED" ? `Completed task “${existing.title}”.` : `Updated task “${existing.title}”.`,
      source, { changedFields }, changes.updatedAt));
    if (!updated) throw new NotFoundError("Task not found.");
    return this.toView(updated);
  }

  completeTask(id: string, source: NewActivityEvent["source"] = "manual"): TaskView {
    return this.updateTask(id, { status: "completed", source });
  }

  archiveTask(id: string, source: NewActivityEvent["source"] = "manual"): TaskView {
    return this.setArchive(id, this.now().toISOString(), "TASK_ARCHIVED", source);
  }

  restoreTask(id: string, source: NewActivityEvent["source"] = "manual"): TaskView {
    return this.setArchive(id, null, "TASK_RESTORED", source);
  }

  private setArchive(id: string, archivedAt: string | null, eventType: string, source: NewActivityEvent["source"]): TaskView {
    idSchema.parse(id);
    const existing = this.repository.findById(id);
    if (!existing) throw new NotFoundError("Task not found.");
    if (existing.archivedAt === archivedAt || (archivedAt !== null && existing.archivedAt)) return this.toView(existing);
    const timestamp = this.now().toISOString();
    const updated = this.repository.update(id, { archivedAt, updatedAt: timestamp }, this.event(
      eventType, id, `${archivedAt ? "Archived" : "Restored"} task “${existing.title}”.`, source, {}, timestamp,
    ));
    if (!updated) throw new NotFoundError("Task not found.");
    return this.toView(updated);
  }

  private assertProject(projectId: string | null | undefined) {
    if (projectId && !this.projects.findById(projectId)) throw new ValidationError("The selected project does not exist.");
  }

  private today() { return calendarToday(this.now()); }
  private toView(task: Task): TaskView {
    return { ...task, targetAfterDue: hasTargetAfterDueRisk(task.targetDate, task.dueDate), overdue: isOverdue(task.dueDate, task.status, this.today()) };
  }
  private event(eventType: string, entityId: string, description: string, source: NewActivityEvent["source"], metadata: Record<string, unknown>, timestamp: string): NewActivityEvent {
    return { id: randomUUID(), eventType, description, entityType: "task", entityId, source, metadata, timestamp };
  }
}
