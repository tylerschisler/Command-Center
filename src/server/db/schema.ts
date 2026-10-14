import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const meetings = sqliteTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    startDateTime: text("start_date_time").notNull(),
    endDateTime: text("end_date_time").notNull(),
    location: text("location"),
    agenda: text("agenda"),
    notes: text("notes"),
    status: text("status", { enum: ["scheduled", "in_progress", "completed", "cancelled"] }).notNull(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("meetings_start_idx").on(table.startDateTime),
    index("meetings_project_id_idx").on(table.projectId),
    index("meetings_status_idx").on(table.status),
    index("meetings_archived_at_idx").on(table.archivedAt),
    check("meetings_status_check", sql`${table.status} in ('scheduled','in_progress','completed','cancelled')`),
    check("meetings_time_check", sql`${table.endDateTime} >= ${table.startDateTime}`),
  ],
);

export const meetingParticipants = sqliteTable(
  "meeting_participants",
  {
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.meetingId, table.personId] }), index("meeting_participants_person_idx").on(table.personId)],
);

export const meetingDecisions = sqliteTable(
  "meeting_decisions",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("meeting_decisions_meeting_idx").on(table.meetingId)],
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
    meetingId: text("meeting_id").references(() => meetings.id, { onDelete: "set null" }),
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
    index("tasks_meeting_id_idx").on(table.meetingId),
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
    meetingId: text("meeting_id").references(() => meetings.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("requests_person_id_idx").on(table.requestedFromPersonId),
    index("requests_project_id_idx").on(table.projectId),
    index("requests_task_id_idx").on(table.relatedTaskId),
    index("requests_meeting_id_idx").on(table.meetingId),
    index("requests_status_idx").on(table.status),
    index("requests_due_date_idx").on(table.dueDate),
    index("requests_archived_at_idx").on(table.archivedAt),
    check("requests_status_check", sql`${table.status} in ('draft','requested','acknowledged','waiting','received','closed')`),
    check("requests_priority_check", sql`${table.priority} in ('critical','high','medium','low')`),
  ],
);

export const knowledgePages = sqliteTable(
  "knowledge_pages",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    summary: text("summary"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("knowledge_pages_title_idx").on(table.title),
    index("knowledge_pages_archived_at_idx").on(table.archivedAt),
  ],
);

export const knowledgeTopics = sqliteTable(
  "knowledge_topics",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull().unique(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("knowledge_topics_name_idx").on(table.name)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull().unique(),
  },
  (table) => [index("tags_name_idx").on(table.name)],
);

export const knowledgePageTopics = sqliteTable(
  "knowledge_page_topics",
  {
    knowledgePageId: text("knowledge_page_id").notNull().references(() => knowledgePages.id, { onDelete: "cascade" }),
    knowledgeTopicId: text("knowledge_topic_id").notNull().references(() => knowledgeTopics.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.knowledgePageId, table.knowledgeTopicId] }),
    index("knowledge_page_topics_topic_idx").on(table.knowledgeTopicId),
  ],
);

export const knowledgePageTags = sqliteTable(
  "knowledge_page_tags",
  {
    knowledgePageId: text("knowledge_page_id").notNull().references(() => knowledgePages.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.knowledgePageId, table.tagId] }),
    index("knowledge_page_tags_tag_idx").on(table.tagId),
  ],
);

export const knowledgeVersions = sqliteTable(
  "knowledge_versions",
  {
    id: text("id").primaryKey(),
    knowledgePageId: text("knowledge_page_id").notNull().references(() => knowledgePages.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    changeDescription: text("change_description").notNull(),
    changedBy: text("changed_by").notNull(),
    changeSource: text("change_source", { enum: ["manual", "jarvis", "voice", "import"] }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("knowledge_versions_page_idx").on(table.knowledgePageId),
    check("knowledge_versions_source_check", sql`${table.changeSource} in ('manual','jarvis','voice','import')`),
  ],
);

export const entityRelationships = sqliteTable(
  "entity_relationships",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    relationshipType: text("relationship_type").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("entity_relationships_source_idx").on(table.sourceType, table.sourceId),
    index("entity_relationships_target_idx").on(table.targetType, table.targetId),
    check("entity_relationships_source_type_check", sql`${table.sourceType} in ('knowledge_page')`),
    check("entity_relationships_target_type_check", sql`${table.targetType} in ('project','person','meeting','knowledge_page')`),
  ],
);

export const briefings = sqliteTable(
  "briefings",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["morning", "end_of_day", "weekly", "custom"] }).notNull(),
    title: text("title").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    structuredFacts: text("structured_facts", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    renderedContent: text("rendered_content").notNull(),
    generatedAt: text("generated_at").notNull(),
    aiGenerated: integer("ai_generated", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("briefings_type_generated_idx").on(table.type, table.generatedAt),
    index("briefings_period_idx").on(table.periodStart, table.periodEnd),
    check("briefings_type_check", sql`${table.type} in ('morning','end_of_day','weekly','custom')`),
    check("briefings_period_check", sql`${table.periodEnd} >= ${table.periodStart}`),
    check("briefings_ai_generated_check", sql`${table.aiGenerated} in (0, 1)`),
  ],
);

export const aiSettings = sqliteTable("ai_settings", {
  id: text("id").primaryKey(),
  cloudAiEnabled: integer("cloud_ai_enabled", { mode: "boolean" }).notNull().default(false),
  voiceEnabled: integer("voice_enabled", { mode: "boolean" }).notNull().default(false),
  sttEnabled: integer("stt_enabled", { mode: "boolean" }).notNull().default(true),
  voiceResponsesEnabled: integer("voice_responses_enabled", { mode: "boolean" }).notNull().default(true),
  speakConfirmations: integer("speak_confirmations", { mode: "boolean" }).notNull().default(true),
  speakBriefings: integer("speak_briefings", { mode: "boolean" }).notNull().default(false),
  speakLongResponses: text("speak_long_responses", { enum: ["ask", "on", "off"] }).notNull().default("ask"),
  automaticSpeechCharacterLimit: integer("automatic_speech_character_limit").notNull().default(280),
  monthlyVoiceWarningSeconds: integer("monthly_voice_warning_seconds"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("ai_settings_long_response_check", sql`${table.speakLongResponses} in ('ask','on','off')`),
  check("ai_settings_speech_limit_check", sql`${table.automaticSpeechCharacterLimit} between 80 and 1000`),
  check("ai_settings_voice_warning_check", sql`${table.monthlyVoiceWarningSeconds} is null or ${table.monthlyVoiceWarningSeconds} > 0`),
]);

export const aiUsageRecords = sqliteTable(
  "ai_usage_records",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    requestTimestamp: text("request_timestamp").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    requestCount: integer("request_count").notNull().default(1),
    estimatedCostMicros: integer("estimated_cost_micros"),
  },
  (table) => [
    index("ai_usage_timestamp_idx").on(table.requestTimestamp),
    check("ai_usage_token_check", sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.requestCount} > 0`),
  ],
);

export const voiceUsageRecords = sqliteTable(
  "voice_usage_records",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["transcription", "speech"] }).notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    requestTimestamp: text("request_timestamp").notNull(),
    audioDurationMs: integer("audio_duration_ms"),
    inputCharacters: integer("input_characters"),
    outputBytes: integer("output_bytes"),
    estimatedCostMicros: integer("estimated_cost_micros"),
  },
  (table) => [
    index("voice_usage_timestamp_idx").on(table.requestTimestamp),
    check("voice_usage_kind_check", sql`${table.kind} in ('transcription','speech')`),
    check("voice_usage_values_check", sql`(${table.audioDurationMs} is null or ${table.audioDurationMs} >= 0) and (${table.inputCharacters} is null or ${table.inputCharacters} >= 0) and (${table.outputBytes} is null or ${table.outputBytes} >= 0)`),
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
export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type MeetingParticipant = typeof meetingParticipants.$inferSelect;
export type MeetingDecision = typeof meetingDecisions.$inferSelect;
export type NewMeetingDecision = typeof meetingDecisions.$inferInsert;
export type KnowledgePage = typeof knowledgePages.$inferSelect;
export type NewKnowledgePage = typeof knowledgePages.$inferInsert;
export type KnowledgeTopic = typeof knowledgeTopics.$inferSelect;
export type NewKnowledgeTopic = typeof knowledgeTopics.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type KnowledgeVersion = typeof knowledgeVersions.$inferSelect;
export type NewKnowledgeVersion = typeof knowledgeVersions.$inferInsert;
export type EntityRelationship = typeof entityRelationships.$inferSelect;
export type NewEntityRelationship = typeof entityRelationships.$inferInsert;
export type Briefing = typeof briefings.$inferSelect;
export type NewBriefing = typeof briefings.$inferInsert;
export type AiSettings = typeof aiSettings.$inferSelect;
export type AiUsageRecord = typeof aiUsageRecords.$inferSelect;
export type NewAiUsageRecord = typeof aiUsageRecords.$inferInsert;
export type VoiceUsageRecord = typeof voiceUsageRecords.$inferSelect;
export type NewVoiceUsageRecord = typeof voiceUsageRecords.$inferInsert;
