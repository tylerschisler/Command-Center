import { and, asc, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, tasks, type NewActivityEvent, type NewTask, type Task } from "@/server/db/schema";

export interface TaskListFilters {
  projectId?: string;
  ownership?: "mine" | "delegated";
  status?: Task["status"];
  archived?: boolean;
}

export interface TaskRepository {
  create(task: NewTask, event: NewActivityEvent): Task;
  findById(id: string): Task | undefined;
  list(filters?: TaskListFilters): Task[];
  update(id: string, changes: Partial<NewTask>, event: NewActivityEvent): Task | undefined;
}

export class DrizzleTaskRepository implements TaskRepository {
  constructor(private readonly database: AppDatabase) {}

  create(task: NewTask, event: NewActivityEvent): Task {
    return this.database.transaction((transaction) => {
      const created = transaction.insert(tasks).values(task).returning().get();
      transaction.insert(activityEvents).values(event).run();
      return created;
    });
  }

  findById(id: string): Task | undefined {
    return this.database.select().from(tasks).where(eq(tasks.id, id)).get();
  }

  list(filters: TaskListFilters = {}): Task[] {
    const conditions: SQL[] = [];
    conditions.push(filters.archived ? isNotNull(tasks.archivedAt) : isNull(tasks.archivedAt));
    if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
    if (filters.ownership === "mine") conditions.push(isNull(tasks.ownerId));
    if (filters.ownership === "delegated") conditions.push(isNotNull(tasks.ownerId));
    if (filters.status) conditions.push(eq(tasks.status, filters.status));
    return this.database.select().from(tasks).where(and(...conditions)).orderBy(asc(tasks.dueDate), desc(tasks.updatedAt)).all();
  }

  update(id: string, changes: Partial<NewTask>, event: NewActivityEvent): Task | undefined {
    return this.database.transaction((transaction) => {
      const updated = transaction.update(tasks).set(changes).where(eq(tasks.id, id)).returning().get();
      if (!updated) return undefined;
      transaction.insert(activityEvents).values(event).run();
      return updated;
    });
  }
}
