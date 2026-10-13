import { and, asc, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, requests, type NewActivityEvent, type NewWorkRequest, type WorkRequest } from "@/server/db/schema";

export interface RequestListFilters {
  personId?: string;
  projectId?: string;
  relatedTaskId?: string;
  status?: WorkRequest["status"];
  archived?: boolean;
}
export interface RequestRepository {
  create(request: NewWorkRequest, event: NewActivityEvent): WorkRequest;
  findById(id: string): WorkRequest | undefined;
  list(filters?: RequestListFilters): WorkRequest[];
  update(id: string, changes: Partial<NewWorkRequest>, event: NewActivityEvent): WorkRequest | undefined;
}
export class DrizzleRequestRepository implements RequestRepository {
  constructor(private readonly database: AppDatabase) {}
  create(request: NewWorkRequest, event: NewActivityEvent): WorkRequest {
    return this.database.transaction((tx) => {
      const created = tx.insert(requests).values(request).returning().get();
      tx.insert(activityEvents).values(event).run();
      return created;
    });
  }
  findById(id: string) { return this.database.select().from(requests).where(eq(requests.id, id)).get(); }
  list(filters: RequestListFilters = {}) {
    const conditions: SQL[] = [filters.archived ? isNotNull(requests.archivedAt) : isNull(requests.archivedAt)];
    if (filters.personId) conditions.push(eq(requests.requestedFromPersonId, filters.personId));
    if (filters.projectId) conditions.push(eq(requests.projectId, filters.projectId));
    if (filters.relatedTaskId) conditions.push(eq(requests.relatedTaskId, filters.relatedTaskId));
    if (filters.status) conditions.push(eq(requests.status, filters.status));
    return this.database.select().from(requests).where(and(...conditions)).orderBy(asc(requests.dueDate), desc(requests.updatedAt)).all();
  }
  update(id: string, changes: Partial<NewWorkRequest>, event: NewActivityEvent): WorkRequest | undefined {
    return this.database.transaction((tx) => {
      const updated = tx.update(requests).set(changes).where(eq(requests.id, id)).returning().get();
      if (!updated) return undefined;
      tx.insert(activityEvents).values(event).run();
      return updated;
    });
  }
}
