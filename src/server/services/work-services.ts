import { getDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { DrizzlePersonRepository } from "@/server/repositories/person-repository";
import { DrizzleRequestRepository } from "@/server/repositories/request-repository";
import { ProjectService } from "./project-service";
import { TaskService } from "./task-service";
import { PersonService } from "./person-service";
import { RequestService } from "./request-service";

export function createWorkServices() {
  const database = getDatabase();
  const activityRepository = new DrizzleActivityEventRepository(database);
  const projectRepository = new DrizzleProjectRepository(database);
  const taskRepository = new DrizzleTaskRepository(database);
  const personRepository = new DrizzlePersonRepository(database);
  const requestRepository = new DrizzleRequestRepository(database);
  return {
    tasks: new TaskService(taskRepository, projectRepository, undefined, personRepository),
    projects: new ProjectService(projectRepository, taskRepository, activityRepository),
    people: new PersonService(personRepository, taskRepository, requestRepository, projectRepository, activityRepository),
    requests: new RequestService(requestRepository, personRepository, projectRepository, taskRepository, activityRepository),
  };
}
