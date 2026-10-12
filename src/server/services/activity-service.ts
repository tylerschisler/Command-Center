import { randomUUID } from "node:crypto";
import type { ActivityEvent, NewActivityEvent } from "@/server/db/schema";
import type { ActivityEventRepository } from "@/server/repositories/activity-event-repository";

export type RecordActivityInput = Omit<NewActivityEvent, "id" | "timestamp"> & { timestamp?: string };

export class ActivityService {
  constructor(private readonly repository: ActivityEventRepository) {}

  record(input: RecordActivityInput): ActivityEvent {
    if (!input.eventType.trim() || !input.description.trim()) throw new Error("Activity event type and description are required.");
    return this.repository.create({ ...input, id: randomUUID(), timestamp: input.timestamp ?? new Date().toISOString() });
  }

  forEntity(entityType: string, entityId: string): ActivityEvent[] {
    return this.repository.listByEntity(entityType, entityId);
  }
}
