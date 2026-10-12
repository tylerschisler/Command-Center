import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
