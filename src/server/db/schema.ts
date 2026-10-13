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
    ownerId: text("owner_id"),
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
    index("tasks_archived_at_idx").on(table.archivedAt),
    check("tasks_status_check", sql`${table.status} in ('not_started','in_progress','waiting','blocked','completed')`),
    check("tasks_priority_check", sql`${table.priority} in ('critical','high','medium','low')`),
    check("tasks_estimated_effort_check", sql`${table.estimatedEffort} is null or ${table.estimatedEffort} >= 0`),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
