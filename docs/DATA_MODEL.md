# Data Model — V1

## Principles
- Local-first.
- Explicit relationships.
- Strong activity history.
- No project milestone entity in V1.
- Projects and Tasks each have both target and due dates.
- Calendar and Journal are views over stored data, not duplicate stores.
- Jarvis operates through services, not direct database access.

## Project
Fields:
- id
- name
- description
- status
- health
- priority
- ownerId (optional)
- startDate
- targetDate
- dueDate
- completedDate
- createdAt
- updatedAt
- archivedAt

Relationships:
- Tasks
- Requests
- Meetings
- Notes
- People
- Knowledge Pages
- Activity Events

The `projects` table uses UUID text IDs, constrained status/health/priority values, ISO `YYYY-MM-DD` calendar dates, ISO timestamps for created/updated/archive audit fields, and no Milestone entity. Project ownership remains nullable and is not expanded in Phase 3; People relationships are derived from delegated Tasks and Requests.

## Task
Fields:
- id
- title
- description
- status
- priority
- ownerId (optional)
- projectId (optional)
- meetingId (optional; durable source/relationship for meeting action items)
- startDate
- targetDate
- dueDate
- completedDate
- recurrenceRuleId (optional)
- estimatedEffort (optional)
- createdAt
- updatedAt
- archivedAt

Rules:
- targetDate may be before or after dueDate.
- If targetDate > dueDate, surface risk.
- Tasks may be owned by the user or another Person.

Phase 2 storage uses the `tasks` table with UUID text IDs and a nullable `projectId` foreign key. Removing a Project relationship sets `projectId` to null rather than deleting the Task. Status and priority are database-constrained. Dates are independent ISO `YYYY-MM-DD` values. `estimatedEffort` is optional non-negative minutes. `recurrenceRuleId` is reserved as a nullable UUID without recurrence behavior or a premature RecurrenceRule table.

Phase 3 ownership is durable: `ownerId = null` and `unresolvedOwnerToken = null` means Mine; a non-null `ownerId` is a foreign key to a real Person and means Delegated. The Phase 2 anonymous UUIDs could not be mapped safely, so migration `0002` moves each one unchanged into nullable `unresolvedOwnerToken`, clears `ownerId`, and creates no fake Person. Those Tasks are excluded from Mine and Delegated filters, visibly marked unresolved in All, and can be repaired by editing the Task and choosing either Mine or a Person. Any explicit owner edit clears the legacy token.

## Request
Fields:
- id
- title
- description
- requestedFromPersonId
- status
- priority
- requestedDate
- dueDate
- followUpDate
- receivedDate
- closedDate
- projectId (optional)
- relatedTaskId (optional)
- meetingId (optional; durable source/relationship for meeting action items)
- createdAt
- updatedAt
- archivedAt

Purpose:
A Request is something someone else owes or is expected to provide.

Phase 3 stores Requests in `requests`. `requestedFromPersonId` is a required Person foreign key; optional Project and related Task relationships use `SET NULL` semantics. Status is constrained to Draft, Requested, Acknowledged, Waiting, Received, or Closed, and priority uses the shared Critical/High/Medium/Low values. Requested and due dates are required date-only values; follow-up, received, closed, and archive dates are nullable. Marking Received sets `receivedDate`; closing sets `closedDate`; neither destroys prior dates.

Derived Request states are not stored: overdue means due date is before today while status is neither Received nor Closed; follow-up needed means follow-up date is today or earlier under the same open-status rule; due soon means an open, non-overdue due date within the next seven calendar days.

## Person
Fields:
- id
- firstName
- lastName
- displayName
- companyOrTeam (optional)
- role (optional)
- notes (optional)
- createdAt
- updatedAt
- archivedAt

Primary derived views:
- open tasks
- open requests
- related projects
- meetings
- notes

Phase 3 stores only lightweight work-contact data in `people`; no addresses, phone numbers, or last-interaction field is added. Open Task, open Request, and active related Project counts are computed through application services rather than duplicated in the Person row.

## Meeting
Fields:
- id
- title
- startDateTime
- endDateTime
- location (optional)
- agenda
- notes
- status
- projectId (optional)
- createdAt
- updatedAt
- archivedAt

Relationships:
- participants
- tasks
- requests
- notes
- decisions
- activity

Phase 4 stores Meetings in `meetings`, with constrained Scheduled/In Progress/Completed/Cancelled status and an optional Project foreign key. `startDateTime` and `endDateTime` are canonical UTC ISO-8601 instants; clients convert local `datetime-local` input to an instant and render it in the local application time zone. End must be at or after start in both service validation and a database CHECK. Notes and agenda remain simple text so Phase 5 Knowledge structures are not preempted.

## MeetingParticipant
Fields:
- meetingId
- personId

`meeting_participants` is a composite-key join table. It stores no duplicated Person attributes; names and other contact details are always read from `people`. Deleting a Meeting removes its joins, while People are otherwise managed independently.

## MeetingDecision
Fields:
- id
- meetingId
- content
- createdAt

Decisions are deliberately minimal structured Meeting records. They appear in Meeting detail and produce `MEETING_DECISION_ADDED` activity.

## KnowledgePage
Fields:
- id
- title
- content
- summary (optional)
- createdAt
- updatedAt
- archivedAt

Relationships:
- multiple Topics
- multiple Tags
- other Knowledge Pages
- Projects
- People
- Meetings
- other entities through generic relationships

Phase 5 stores pages in `knowledge_pages`. Content is Markdown source and may be empty. Active queries exclude `archivedAt` by default; archive and restore preserve versions, taxonomy joins, and entity relationships. There is no forced folder hierarchy.

## KnowledgeTopic
Fields:
- id
- name
- description (optional)

Many-to-many with KnowledgePage.

Phase 5 stores a whitespace-collapsed, case-folded `normalizedName` with a unique constraint. This prevents trivial duplicate Topic names while preserving the user-facing spelling.

## Tag
Fields:
- id
- name

Many-to-many with KnowledgePage and optionally other entities later.

Phase 5 applies the same normalized-name uniqueness rule to Tags. `knowledge_page_topics` and `knowledge_page_tags` use composite primary keys so a page can appear once in each Topic/Tag without duplicating the page itself.

## KnowledgeVersion
Fields:
- id
- knowledgePageId
- content
- changeDescription
- changedBy
- changeSource
- createdAt

Suggested changeSource:
- manual
- jarvis
- voice
- import

Phase 5 creates an initial version with every page and a new complete-content version for each explicit save that changes content. Restoring a prior version copies its content into the page and creates another version; existing history is immutable and never deleted by restore or archive.

## Note
Fields:
- id
- title (optional)
- content
- createdAt
- updatedAt

Notes may attach to:
- Project
- Task
- Request
- Meeting
- Person

## ActivityEvent
Fields:
- id
- eventType
- description
- entityType
- entityId
- source
- metadata
- timestamp

Examples:
- TASK_CREATED
- TASK_UPDATED
- TASK_COMPLETED
- REQUEST_CREATED
- REQUEST_RECEIVED
- PROJECT_UPDATED
- MEETING_NOTE_ADDED
- KNOWLEDGE_UPDATED
- BRIEFING_GENERATED

## RecurrenceRule
Fields:
- id
- frequency
- interval
- daysOfWeek (optional)
- dayOfMonth (optional)
- monthOfYear (optional)
- startDate
- endDate (optional)
- leadTime (optional)
- templateEntityType
- templateEntityId

Expected V1 recurrence:
- daily
- weekly
- monthly
- quarterly
- annual

Generated task instances must preserve history.

## EntityRelationship
Fields:
- id
- sourceType
- sourceId
- relationshipType
- targetType
- targetId
- createdAt

Purpose:
Provide flexible cross-entity relationships without hard-coding every possible connection.

Phase 5 implements `entity_relationships` for a Knowledge Page source and Project, Person, Meeting, or Knowledge Page targets. A unique database index prevents duplicate source/type/target relationships, while service validation rejects missing targets and self-relations.

## Knowledge Search
`knowledge_pages_fts` is an SQLite FTS5 external-content index over page title, content, and summary. Insert/update/delete triggers keep it synchronized with `knowledge_pages`. Topic and Tag name matches are combined with FTS results through local SQL. The virtual table is a derived index, not a second source of truth.

## Attachment
Fields:
- id
- filename
- fileType
- localPath
- entityType
- entityId
- createdAt

V1 may provide minimal attachment support.

## Briefing
Fields:
- id
- type
- title
- periodStart
- periodEnd
- structuredFacts
- renderedContent
- generatedAt
- aiGenerated
- createdAt

Suggested types:
- morning
- end_of_day
- weekly
- custom

Phase 6 persists these records in `briefings`. `structuredFacts` is versioned JSON (`version: 1`) containing the exact current dashboard projection, period-scoped ActivityEvent groups, recorded Meeting decisions, and the next-day or next-week projection used to render the briefing. `renderedContent` is deterministic Markdown-like text generated only from that payload; `aiGenerated` is always false in Phase 6. Regeneration creates a new immutable snapshot instead of replacing an earlier briefing, so the library preserves what was generated at each point in time. A `BRIEFING_GENERATED` ActivityEvent is committed atomically with each record.

## InboxItem
Optional V1 entity if required by implementation.

Fields:
- id
- rawContent
- source
- createdAt
- processedAt
- resultingEntityType
- resultingEntityId

## IntelligenceItem
Fields:
- id
- headline
- sourceName
- sourceUrl
- publicationDate
- summary
- relevanceScore
- whyItMatters
- topics
- fetchedAt

## Calendar Model
No standalone Calendar entity.

Calendar renders time-based fields from:
- Meeting.startDateTime
- Task.targetDate
- Task.dueDate
- Project.targetDate
- Project.dueDate
- Request.dueDate
- Request.followUpDate

Phase 4 implements this as a read-only `CalendarService` projection. Meeting instants are converted to their local calendar day for display. Task, Project, and Request fields remain independent `YYYY-MM-DD` calendar dates and are projected as distinct Target, Due, or Follow-Up events. There is no Calendar table.

## Journal Model
No standalone daily journal required for system activity.

Daily journal view is built primarily from ActivityEvent plus optional manually created journal-style Note entries.

## Key Relationship Semantics
Task:
- work someone must perform

Request:
- something expected from another person

Note:
- contextual information

Knowledge Page:
- reusable/persistent knowledge

Activity Event:
- immutable historical record of what happened

## Phase 7 AI Settings and Usage

`ai_settings` is a singleton local preference record containing only the Cloud AI enabled flag and update timestamp. Cloud AI defaults off. `ai_usage_records` stores one local accounting row per provider request sequence: provider, model, request timestamp, input/output token counts, request count, and nullable estimated cost in micros. It never stores prompts, responses, tool arguments, API keys, or conversation history. Both tables reside inside the existing encrypted SQLite database.
