import { and, asc, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, entityRelationships, meetings, projects, requests, tasks, type NewActivityEvent, type NewProject, type Project } from "@/server/db/schema";

export interface ProjectDeleteImpact { tasks: number; requests: number; meetings: number; knowledgeRelationships: number }

export interface ProjectListFilters {
  status?: Project["status"];
  archived?: boolean;
}

export interface ProjectRepository {
  create(project: NewProject, event: NewActivityEvent): Project;
  findById(id: string): Project | undefined;
  list(filters?: ProjectListFilters): Project[];
  update(id: string, changes: Partial<NewProject>, event: NewActivityEvent): Project | undefined;
  delete(id: string, event: NewActivityEvent): ProjectDeleteImpact | undefined;
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
  delete(id: string, event: NewActivityEvent) {
    return this.database.transaction((transaction) => {
      if (!transaction.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get()) return undefined;
      const impact = {
        tasks: transaction.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, id)).all().length,
        requests: transaction.select({ id: requests.id }).from(requests).where(eq(requests.projectId, id)).all().length,
        meetings: transaction.select({ id: meetings.id }).from(meetings).where(eq(meetings.projectId, id)).all().length,
        knowledgeRelationships: transaction.select({ id: entityRelationships.id }).from(entityRelationships).where(and(eq(entityRelationships.targetType, "project"), eq(entityRelationships.targetId, id))).all().length,
      };
      transaction.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, id)).run();
      transaction.update(requests).set({ projectId: null }).where(eq(requests.projectId, id)).run();
      transaction.update(meetings).set({ projectId: null }).where(eq(meetings.projectId, id)).run();
      transaction.delete(entityRelationships).where(and(eq(entityRelationships.targetType, "project"), eq(entityRelationships.targetId, id))).run();
      transaction.delete(projects).where(eq(projects.id, id)).run();
      transaction.insert(activityEvents).values(event).run();
      return impact;
    });
  }
}
