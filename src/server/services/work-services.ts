import { getDatabase, type AppDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { DrizzleProjectRepository } from "@/server/repositories/project-repository";
import { DrizzleTaskRepository } from "@/server/repositories/task-repository";
import { DrizzlePersonRepository } from "@/server/repositories/person-repository";
import { DrizzleRequestRepository } from "@/server/repositories/request-repository";
import { DrizzleMeetingRepository } from "@/server/repositories/meeting-repository";
import { DrizzleKnowledgeRepository } from "@/server/repositories/knowledge-repository";
import { DrizzleBriefingRepository, DrizzleCommandCenterRepository } from "@/server/repositories/command-center-repository";
import { DrizzleIntelligenceRepository } from "@/server/repositories/intelligence-repository";
import { configuredIntelligenceSources, DeterministicFakeIntelligenceProvider, PublicFeedIntelligenceProvider } from "@/server/intelligence/intelligence-provider";
import { getEnvironment } from "@/config/env";
import { ProjectService } from "./project-service";
import { TaskService } from "./task-service";
import { PersonService } from "./person-service";
import { RequestService } from "./request-service";
import { MeetingService } from "./meeting-service";
import { CalendarService } from "./calendar-service";
import { KnowledgeService } from "./knowledge-service";
import { BriefingService, CommandCenterService } from "./briefing-service";
import { ActivityService } from "./activity-service";
import { IntelligenceService } from "./intelligence-service";

export function createWorkServices(database: AppDatabase = getDatabase()) {
  const activityRepository = new DrizzleActivityEventRepository(database);
  const projectRepository = new DrizzleProjectRepository(database);
  const taskRepository = new DrizzleTaskRepository(database);
  const personRepository = new DrizzlePersonRepository(database);
  const requestRepository = new DrizzleRequestRepository(database);
  const meetingRepository = new DrizzleMeetingRepository(database);
  const knowledgeRepository = new DrizzleKnowledgeRepository(database);
  const commandCenterRepository = new DrizzleCommandCenterRepository(database);
  const briefingRepository = new DrizzleBriefingRepository(database);
  const intelligenceRepository = new DrizzleIntelligenceRepository(database);
  const taskService = new TaskService(taskRepository, projectRepository, undefined, personRepository, meetingRepository);
  const requestService = new RequestService(requestRepository, personRepository, projectRepository, taskRepository, activityRepository, undefined, meetingRepository);
  const knowledgeService = new KnowledgeService(knowledgeRepository, projectRepository, personRepository, meetingRepository, activityRepository);
  return {
    tasks: taskService,
    projects: new ProjectService(projectRepository, taskRepository, activityRepository),
    people: new PersonService(personRepository, taskRepository, requestRepository, projectRepository, activityRepository, undefined, meetingRepository),
    requests: requestService,
    meetings: new MeetingService(meetingRepository, personRepository, projectRepository, taskRepository, requestRepository, taskService, requestService, activityRepository),
    calendar: new CalendarService(meetingRepository, taskRepository, projectRepository, requestRepository),
    knowledge: knowledgeService,
    intelligence: new IntelligenceService(intelligenceRepository, getEnvironment().COMMAND_CENTER_FAKE_AI && process.env.NODE_ENV !== "production" ? new DeterministicFakeIntelligenceProvider() : new PublicFeedIntelligenceProvider(configuredIntelligenceSources(getEnvironment().INTELLIGENCE_SOURCES_JSON)), knowledgeService),
    commandCenter: new CommandCenterService(commandCenterRepository),
    briefings: new BriefingService(commandCenterRepository, briefingRepository),
    activity: new ActivityService(activityRepository),
  };
}
