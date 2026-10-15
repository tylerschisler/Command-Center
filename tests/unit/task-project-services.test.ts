import { describe, expect, it } from "vitest";
import type { ActivityEvent, NewActivityEvent, NewProject, NewTask, Project, Task } from "@/server/db/schema";
import type { ActivityEventRepository } from "@/server/repositories/activity-event-repository";
import type { ProjectListFilters, ProjectRepository } from "@/server/repositories/project-repository";
import type { TaskListFilters, TaskRepository } from "@/server/repositories/task-repository";
import { ProjectService } from "@/server/services/project-service";
import { TaskService } from "@/server/services/task-service";

class MemoryActivity implements ActivityEventRepository {
  events: ActivityEvent[] = [];
  create(event: NewActivityEvent) { const created = event as ActivityEvent; this.events.push(created); return created; }
  listByEntity(entityType: string, entityId: string) { return this.events.filter((event) => event.entityType === entityType && event.entityId === entityId); }
}
class MemoryProjects implements ProjectRepository {
  items = new Map<string, Project>();
  constructor(private activity: MemoryActivity) {}
  create(value: NewProject, event: NewActivityEvent) { const item = value as Project; this.items.set(item.id, item); this.activity.create(event); return item; }
  findById(id: string) { return this.items.get(id); }
  list(filters: ProjectListFilters = {}) { return [...this.items.values()].filter((item) => (filters.archived ? Boolean(item.archivedAt) : !item.archivedAt) && (!filters.status || item.status === filters.status)); }
  update(id: string, changes: Partial<NewProject>, event: NewActivityEvent) { const existing = this.items.get(id); if (!existing) return undefined; const item = { ...existing, ...changes }; this.items.set(id, item); this.activity.create(event); return item; }
  delete(id: string, event: NewActivityEvent) { if (!this.items.delete(id)) return undefined; this.activity.create(event); return { tasks: 0, requests: 0, meetings: 0, knowledgeRelationships: 0 }; }
}
class MemoryTasks implements TaskRepository {
  items = new Map<string, Task>();
  constructor(private activity: MemoryActivity) {}
  create(value: NewTask, event: NewActivityEvent) { const item = value as Task; this.items.set(item.id, item); this.activity.create(event); return item; }
  findById(id: string) { return this.items.get(id); }
  list(filters: TaskListFilters = {}) { return [...this.items.values()].filter((item) => (filters.archived ? Boolean(item.archivedAt) : !item.archivedAt) && (!filters.projectId || item.projectId === filters.projectId) && (!filters.status || item.status === filters.status) && (!filters.ownership || (filters.ownership === "mine" ? !item.ownerId : Boolean(item.ownerId)))); }
  update(id: string, changes: Partial<NewTask>, event: NewActivityEvent) { const existing = this.items.get(id); if (!existing) return undefined; const item = { ...existing, ...changes }; this.items.set(id, item); this.activity.create(event); return item; }
  delete(id: string, event: NewActivityEvent) { if (!this.items.delete(id)) return false; this.activity.create(event); return true; }
}

const clock = () => new Date("2026-05-10T12:00:00.000Z");

describe("TaskService", () => {
  it("creates, updates, and completes a task with activity", () => {
    const activity = new MemoryActivity(); const projects = new MemoryProjects(activity); const tasks = new MemoryTasks(activity);
    const projectService = new ProjectService(projects, tasks, activity, clock);
    const project = projectService.createProject({ name: "Foundation", targetDate: "2026-05-12", dueDate: "2026-05-10" });
    const service = new TaskService(tasks, projects, clock);
    const task = service.createTask({ title: "Write tests", projectId: project.id, targetDate: "2026-05-12", dueDate: "2026-05-10" });
    expect(task.targetAfterDue).toBe(true);
    expect(service.updateTask(task.id, { priority: "high" }).priority).toBe("high");
    const completed = service.completeTask(task.id);
    expect(completed.status).toBe("completed"); expect(completed.completedDate).toBe("2026-05-10");
    expect(activity.listByEntity("task", task.id).map((event) => event.eventType)).toEqual(["TASK_CREATED", "TASK_UPDATED", "TASK_COMPLETED"]);
    expect(() => service.getTask("not-an-id")).toThrow();
    expect(() => service.createTask({ title: "Bad date", dueDate: "2026-02-30" })).toThrow();
  });
  it("requires explicit confirmation for permanent deletion", () => {
    const activity = new MemoryActivity(); const projects = new MemoryProjects(activity); const tasks = new MemoryTasks(activity); const service = new TaskService(tasks, projects, clock);
    const task = service.createTask({ title: "Disposable" });
    expect(() => service.deleteTask(task.id, "yes")).toThrow(/DELETE/);
    expect(service.getTask(task.id).title).toBe("Disposable");
    expect(service.deleteTask(task.id, "DELETE")).toEqual({ deleted: true, id: task.id });
    expect(activity.listByEntity("task", task.id).at(-1)?.eventType).toBe("TASK_DELETED");
  });
});

describe("ProjectService", () => {
  it("creates, updates, completes, and calculates task progress", () => {
    const activity = new MemoryActivity(); const projects = new MemoryProjects(activity); const tasks = new MemoryTasks(activity);
    const service = new ProjectService(projects, tasks, activity, clock); const taskService = new TaskService(tasks, projects, clock);
    const project = service.createProject({ name: "Launch", status: "active" });
    const task = taskService.createTask({ title: "Ship", projectId: project.id });
    expect(service.getProject(project.id).progress.percent).toBe(0);
    taskService.completeTask(task.id);
    expect(service.getProject(project.id).progress).toMatchObject({ percent: 100, completedTasks: 1, totalTasks: 1 });
    expect(service.updateProject(project.id, { health: "at_risk" }).health).toBe("at_risk");
    expect(service.completeProject(project.id).completedDate).toBe("2026-05-10");
    expect(activity.listByEntity("project", project.id).map((event) => event.eventType)).toEqual(["PROJECT_CREATED", "PROJECT_HEALTH_CHANGED", "PROJECT_COMPLETED"]);
  });
  it("deletes a project only after confirmation", () => {
    const activity = new MemoryActivity(); const projects = new MemoryProjects(activity); const tasks = new MemoryTasks(activity); const service = new ProjectService(projects, tasks, activity, clock);
    const project = service.createProject({ name: "Disposable" });
    expect(() => service.deleteProject(project.id, "no")).toThrow(/DELETE/);
    expect(service.deleteProject(project.id, "DELETE")).toMatchObject({ deleted: true, id: project.id });
    expect(activity.listByEntity("project", project.id).at(-1)?.eventType).toBe("PROJECT_DELETED");
  });
});
