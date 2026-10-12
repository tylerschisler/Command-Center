import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, type ActivityEvent, type NewActivityEvent } from "@/server/db/schema";

export interface ActivityEventRepository {
  create(event: NewActivityEvent): ActivityEvent;
  listByEntity(entityType: string, entityId: string): ActivityEvent[];
}

export class DrizzleActivityEventRepository implements ActivityEventRepository {
  constructor(private readonly database: AppDatabase) {}

  create(event: NewActivityEvent): ActivityEvent {
    return this.database.insert(activityEvents).values(event).returning().get();
  }

  listByEntity(entityType: string, entityId: string): ActivityEvent[] {
    return this.database
      .select()
      .from(activityEvents)
      .where(and(eq(activityEvents.entityType, entityType), eq(activityEvents.entityId, entityId)))
      .orderBy(desc(activityEvents.timestamp))
      .all();
  }
}
