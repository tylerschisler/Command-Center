import { z } from "zod";
import { MEETING_STATUSES, PRIORITIES, PROJECT_HEALTH, PROJECT_STATUSES, REQUEST_STATUSES, TASK_STATUSES } from "@/domain/work";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid YYYY-MM-DD date.").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a valid calendar date.");
const nullableDate = calendarDate.nullable().optional();
const nullableId = z.string().uuid().nullable().optional();
const source = z.enum(["manual", "system", "import", "jarvis", "voice"]).default("manual");

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).default(""),
  status: z.enum(TASK_STATUSES).default("not_started"),
  priority: z.enum(PRIORITIES).default("medium"),
  ownerId: nullableId,
  projectId: nullableId,
  meetingId: nullableId,
  startDate: nullableDate,
  targetDate: nullableDate,
  dueDate: nullableDate,
  completedDate: nullableDate,
  recurrenceRuleId: nullableId,
  estimatedEffort: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  source,
});

export const taskUpdateSchema = taskCreateSchema.omit({ source: true }).partial().extend({ source });

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).default(""),
  status: z.enum(PROJECT_STATUSES).default("planning"),
  health: z.enum(PROJECT_HEALTH).default("on_track"),
  priority: z.enum(PRIORITIES).default("medium"),
  ownerId: nullableId,
  startDate: nullableDate,
  targetDate: nullableDate,
  dueDate: nullableDate,
  completedDate: nullableDate,
  source,
});

export const projectUpdateSchema = projectCreateSchema.omit({ source: true }).partial().extend({ source });

export const personCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(200).optional(),
  companyOrTeam: z.string().trim().max(200).nullable().optional(),
  role: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  source,
});
export const personUpdateSchema = personCreateSchema.omit({ source: true }).partial().extend({ source });

export const requestCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).default(""),
  requestedFromPersonId: z.string().uuid(),
  status: z.enum(REQUEST_STATUSES).default("draft"),
  priority: z.enum(PRIORITIES).default("medium"),
  requestedDate: calendarDate,
  dueDate: calendarDate,
  followUpDate: nullableDate,
  receivedDate: nullableDate,
  closedDate: nullableDate,
  projectId: nullableId,
  relatedTaskId: nullableId,
  meetingId: nullableId,
  source,
});
export const requestUpdateSchema = requestCreateSchema.omit({ source: true }).partial().extend({ source });

const dateTime = z.string().datetime({ offset: true });
const meetingFields = z.object({
  title: z.string().trim().min(1).max(200),
  startDateTime: dateTime,
  endDateTime: dateTime,
  location: z.string().trim().max(500).nullable().optional(),
  agenda: z.string().trim().max(20_000).nullable().optional(),
  notes: z.string().trim().max(100_000).nullable().optional(),
  status: z.enum(MEETING_STATUSES),
  projectId: nullableId,
});
export const meetingCreateSchema = meetingFields.extend({ status: z.enum(MEETING_STATUSES).default("scheduled"), participantIds: z.array(z.string().uuid()).max(500).default([]).transform((ids) => [...new Set(ids)]), source }).refine((value) => value.endDateTime >= value.startDateTime, { message: "Meeting end time cannot be before its start time.", path: ["endDateTime"] });
export const meetingUpdateSchema = meetingFields.partial().extend({ source });
export const decisionCreateSchema = z.object({ content: z.string().trim().min(1).max(10_000), source });

export const KNOWLEDGE_CHANGE_SOURCES = ["manual", "jarvis", "voice", "import"] as const;
export const KNOWLEDGE_RELATIONSHIP_TARGETS = ["project", "person", "meeting", "knowledge_page"] as const;
const changeSource = z.enum(KNOWLEDGE_CHANGE_SOURCES).default("manual");
export const knowledgePageCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(500_000).default(""),
  summary: z.string().trim().max(2_000).nullable().optional(),
  changeDescription: z.string().trim().min(1).max(500).default("Initial version"),
  changedBy: z.string().trim().min(1).max(200).default("Current user"),
  changeSource,
  source,
});
export const knowledgePageUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(500_000).optional(),
  summary: z.string().trim().max(2_000).nullable().optional(),
  changeDescription: z.string().trim().min(1).max(500).optional(),
  changedBy: z.string().trim().min(1).max(200).optional(),
  changeSource: z.enum(KNOWLEDGE_CHANGE_SOURCES).optional(),
  source,
});
export const knowledgeTopicCreateSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(1_000).nullable().optional(), source });
export const knowledgeTopicUpdateSchema = knowledgeTopicCreateSchema.omit({ source: true }).partial().extend({ source });
export const knowledgeTagCreateSchema = z.object({ name: z.string().trim().min(1).max(100), source });
export const knowledgeRelationshipCreateSchema = z.object({
  targetType: z.enum(KNOWLEDGE_RELATIONSHIP_TARGETS),
  targetId: z.string().uuid(),
  relationshipType: z.string().trim().min(1).max(100).default("related_to"),
  source,
});
export const knowledgeVersionRestoreSchema = z.object({ versionId: z.string().uuid(), changeDescription: z.string().trim().min(1).max(500).default("Restored a previous version"), changedBy: z.string().trim().min(1).max(200).default("Current user"), source });

export const idSchema = z.string().uuid();
