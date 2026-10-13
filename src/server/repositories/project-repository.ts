import { and, asc, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, projects, type NewActivityEvent, type NewProject, type Project } from "@/server/db/schema";

export interface ProjectListFilters {
  status?: Project["status"];
  archived?: boolean;
}

export interface ProjectRepository {
  create(project: NewProject, event: NewActivityEvent): Project;
  findById(id: string): Project | undefined;
  list(filters?: ProjectListFilters): Project[];
  update(id: string, changes: Partial<NewProject>, event: NewActivityEvent): Project | undefined;
}

export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private readonly database: AppDatabase) {}

  create(project: NewProject, event: NewActivityEvent): Project {
    return this.database.transaction((transaction) => {
      const created = transaction.insert(projects).values(project).returning().get();
      transaction.insert(activityEvents).values(event).run();
      return created;
    });
  }

  findById(id: string): Project | undefined {
    return this.database.select().from(projects).where(eq(projects.id, id)).get();
  }

  list(filters: ProjectListFilters = {}): Project[] {
    const conditions: SQL[] = [filters.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)];
    if (filters.status) conditions.push(eq(projects.status, filters.status));
    return this.database.select().from(projects).where(and(...conditions)).orderBy(asc(projects.dueDate), desc(projects.updatedAt)).all();
  }

  update(id: string, changes: Partial<NewProject>, event: NewActivityEvent): Project | undefined {
    return this.database.transaction((transaction) => {
      const updated = transaction.update(projects).set(changes).where(eq(projects.id, id)).returning().get();
      if (!updated) return undefined;
      transaction.insert(activityEvents).values(event).run();
      return updated;
    });
  }
}
