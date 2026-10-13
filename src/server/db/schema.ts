import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    description: text("description").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    source: text("source", { enum: ["manual", "system", "import", "jarvis", "voice"] }).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    timestamp: text("timestamp").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("activity_events_entity_idx").on(table.entityType, table.entityId),
    index("activity_events_timestamp_idx").on(table.timestamp),
  ],
);

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;

export const people = sqliteTable(
  "people",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    displayName: text("display_name").notNull(),
    companyOrTeam: text("company_or_team"),
    role: text("role"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("people_display_name_idx").on(table.displayName),
    index("people_archived_at_idx").on(table.archivedAt),
  ],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["planning", "active", "on_hold", "completed", "cancelled"] }).notNull(),
    health: text("health", { enum: ["on_track", "at_risk", "off_track"] }).notNull(),
    priority: text("priority", { enum: ["critical", "high", "medium", "low"] }).notNull(),
    ownerId: text("owner_id"),
    startDate: text("start_date"),
    targetDate: text("target_date"),
    dueDate: text("due_date"),
    completedDate: text("completed_date"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("projects_status_idx").on(table.status),
    index("projects_archived_at_idx").on(table.archivedAt),
    check("projects_status_check", sql`${table.status} in ('planning','active','on_hold','completed','cancelled')`),
    check("projects_health_check", sql`${table.health} in ('on_track','at_risk','off_track')`),
    check("projects_priority_check", sql`${table.priority} in ('critical','high','medium','low')`),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["not_started", "in_progress", "waiting", "blocked", "completed"] }).notNull(),
    priority: text("priority", { enum: ["critical", "high", "medium", "low"] }).notNull(),
    ownerId: text("owner_id").references(() => people.id, { onDelete: "set null" }),
    unresolvedOwnerToken: text("unresolved_owner_token"),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    startDate: text("start_date"),
    targetDate: text("target_date"),
    dueDate: text("due_date"),
    completedDate: text("completed_date"),
    recurrenceRuleId: text("recurrence_rule_id"),
    estimatedEffort: integer("estimated_effort"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_status_idx").on(table.status),
    index("tasks_owner_id_idx").on(table.ownerId),
    index("tasks_unresolved_owner_token_idx").on(table.unresolvedOwnerToken),
    index("tasks_archived_at_idx").on(table.archivedAt),
    check("tasks_status_check", sql`${table.status} in ('not_started','in_progress','waiting','blocked','completed')`),
    check("tasks_priority_check", sql`${table.priority} in ('critical','high','medium','low')`),
    check("tasks_estimated_effort_check", sql`${table.estimatedEffort} is null or ${table.estimatedEffort} >= 0`),
  ],
);

export const requests = sqliteTable(
  "requests",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    requestedFromPersonId: text("requested_from_person_id").notNull().references(() => people.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["draft", "requested", "acknowledged", "waiting", "received", "closed"] }).notNull(),
    priority: text("priority", { enum: ["critical", "high", "medium", "low"] }).notNull(),
    requestedDate: text("requested_date").notNull(),
    dueDate: text("due_date").notNull(),
    followUpDate: text("follow_up_date"),
    receivedDate: text("received_date"),
    closedDate: text("closed_date"),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    relatedTaskId: text("related_task_id").references(() => tasks.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("requests_person_id_idx").on(table.requestedFromPersonId),
    index("requests_project_id_idx").on(table.projectId),
    index("requests_task_id_idx").on(table.relatedTaskId),
    index("requests_status_idx").on(table.status),
    index("requests_due_date_idx").on(table.dueDate),
    index("requests_archived_at_idx").on(table.archivedAt),
    check("requests_status_check", sql`${table.status} in ('draft','requested','acknowledged','waiting','received','closed')`),
    check("requests_priority_check", sql`${table.priority} in ('critical','high','medium','low')`),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type WorkRequest = typeof requests.$inferSelect;
export type NewWorkRequest = typeof requests.$inferInsert;
