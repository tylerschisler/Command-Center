import { getDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { ProjectService } from "./project-service";
import { TaskService } from "./task-service";

export function createWorkServices() {
  const database = getDatabase();
  const activityRepository = new DrizzleActivityEventRepository(database);
  const projectRepository = new DrizzleProjectRepository(database);
  const taskRepository = new DrizzleTaskRepository(database);
  return {
    tasks: new TaskService(taskRepository, projectRepository),
    projects: new ProjectService(projectRepository, taskRepository, activityRepository),
  };
}
