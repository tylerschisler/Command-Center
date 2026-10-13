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

Relationships:
- participants
- tasks
- requests
- notes
- decisions
- activity

## MeetingParticipant
Fields:
- meetingId
- personId

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

## KnowledgeTopic
Fields:
- id
- name
- description (optional)

Many-to-many with KnowledgePage.

## Tag
Fields:
- id
- name

Many-to-many with KnowledgePage and optionally other entities later.

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
