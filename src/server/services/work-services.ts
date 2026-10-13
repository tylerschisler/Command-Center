import { getDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { DrizzlePersonRepository } from "@/server/repositories/person-repository";
import { DrizzleRequestRepository } from "@/server/repositories/request-repository";
import { DrizzleMeetingRepository } from "@/server/repositories/meeting-repository";
import { DrizzleKnowledgeRepository } from "@/server/repositories/knowledge-repository";
import { ProjectService } from "./project-service";
import { TaskService } from "./task-service";
import { PersonService } from "./person-service";
import { RequestService } from "./request-service";
import { MeetingService } from "./meeting-service";
import { CalendarService } from "./calendar-service";
import { KnowledgeService } from "./knowledge-service";

export function createWorkServices() {
  const database = getDatabase();
  const activityRepository = new DrizzleActivityEventRepository(database);
  const projectRepository = new DrizzleProjectRepository(database);
  const taskRepository = new DrizzleTaskRepository(database);
  const personRepository = new DrizzlePersonRepository(database);
  const requestRepository = new DrizzleRequestRepository(database);
  const meetingRepository = new DrizzleMeetingRepository(database);
  const knowledgeRepository = new DrizzleKnowledgeRepository(database);
  const taskService = new TaskService(taskRepository, projectRepository, undefined, personRepository, meetingRepository);
  const requestService = new RequestService(requestRepository, personRepository, projectRepository, taskRepository, activityRepository, undefined, meetingRepository);
  return {
    tasks: taskService,
    projects: new ProjectService(projectRepository, taskRepository, activityRepository),
    people: new PersonService(personRepository, taskRepository, requestRepository, projectRepository, activityRepository, undefined, meetingRepository),
    requests: requestService,
    meetings: new MeetingService(meetingRepository, personRepository, projectRepository, taskRepository, requestRepository, taskService, requestService, activityRepository),
    calendar: new CalendarService(meetingRepository, taskRepository, projectRepository, requestRepository),
    knowledge: new KnowledgeService(knowledgeRepository, projectRepository, personRepository, meetingRepository, activityRepository),
  };
}
