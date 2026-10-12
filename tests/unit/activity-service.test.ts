import { describe, expect, it } from "vitest";
import { ActivityService } from "@/server/services/activity-service";
import type { ActivityEventRepository } from "@/server/repositories/activity-event-repository";
import type { ActivityEvent, NewActivityEvent } from "@/server/db/schema";

describe("ActivityService", () => {
  it("routes writes and reads through its repository", () => {
    const events: ActivityEvent[] = [];
    const repository: ActivityEventRepository = {
      create(event: NewActivityEvent) { const saved = event as ActivityEvent; events.push(saved); return saved; },
      listByEntity(type, id) { return events.filter((event) => event.entityType === type && event.entityId === id); },
    };
    const service = new ActivityService(repository);
    service.record({ eventType:"FOUNDATION_TESTED", description:"Service works", entityType:"system", entityId:"foundation", source:"system", metadata:{} });
    expect(service.forEntity("system", "foundation")).toHaveLength(1);
  });
});
