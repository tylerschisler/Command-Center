import { getDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { ActivityService } from "./activity-service";

export function createServices() {
  const database = getDatabase();
  return { activity: new ActivityService(new DrizzleActivityEventRepository(database)) };
}

export type ApplicationServices = ReturnType<typeof createServices>;
