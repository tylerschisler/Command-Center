import { z } from "zod";
import { PRIORITIES, PROJECT_HEALTH, PROJECT_STATUSES, REQUEST_STATUSES, TASK_STATUSES } from "@/domain/work";

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
  source,
});
export const requestUpdateSchema = requestCreateSchema.omit({ source: true }).partial().extend({ source });

export const idSchema = z.string().uuid();
