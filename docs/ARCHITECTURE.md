# Technical Architecture — V1

## Goals
- local-first
- single-user
- reliable without AI
- cloud AI allowed
- cloud AI receives minimum necessary context
- local encrypted storage
- automatic encrypted backups
- modular AI and voice providers
- strong service boundaries

## Proposed Stack
Frontend:
- Next.js
- React
- TypeScript

Database:
- SQLite

ORM:
- Drizzle ORM with `better-sqlite3`
- ORM purpose: typed, safer application-to-database access and schema migrations

### ORM Decision (Phase 1)
Drizzle was selected over Prisma for the local-first SQLite foundation. It offers strongly typed TypeScript queries while staying close to SQLite and producing reviewable, versioned SQL migrations. Its small runtime surface and lack of a generated database client are a good fit for a single-user local application. `better-sqlite3` provides a direct synchronous local connection, which keeps transaction boundaries straightforward for the future requirement that a domain mutation and its `ActivityEvent` commit atomically.

Prisma would also provide good TypeScript ergonomics and a mature migration workflow, but its generated client and additional runtime abstraction are unnecessary at this stage. Drizzle's explicit SQL artifacts make migrations and future encryption-driver evaluation easier to inspect and maintain.

Migration workflow:
1. edit `src/server/db/schema.ts`
2. run `npm run db:generate`
3. review and commit the generated SQL and migration metadata under `drizzle/`
4. create a restore point before production migrations once backup support exists
5. run `npm run db:migrate` to apply pending migrations

Testing:
- unit tests
- integration tests
- end-to-end tests

Source control:
- Git

Development:
- VS Code
- Codex

## Application Layers
UI
↓
Application Services
↓
Repository / ORM
↓
SQLite

Jarvis:
Jarvis Reasoning
↓
Jarvis Tool Controller
↓
Application Services
↓
Repository / ORM
↓
SQLite

Jarvis must not bypass the service layer.

## Service Layer
Expected services include:
- TaskService
- ProjectService
- RequestService
- PersonService
- MeetingService
- KnowledgeService
- ActivityService
- BriefingService
- SearchService
- BackupService
- IntelligenceService

Each service should own domain logic for its entity.

Phase 1 establishes this boundary with `ActivityService`, an `ActivityEventRepository` interface, and a Drizzle repository implementation. UI and future AI controllers depend on application services; only repository implementations may use the ORM. Future meaningful mutations should use a shared database transaction for the domain write and `ActivityEvent` creation.

## Activity Logging
Meaningful mutations must create ActivityEvents.

Example:
`TaskService.completeTask()`
1. validate
2. update task
3. persist
4. create ActivityEvent
5. return result

Activity history must not rely on AI memory.

## AI Provider Abstraction
Define an interface such as:
- generateResponse()
- callTools()
- summarize()
- structuredOutput()

V1 cloud provider may use OpenAI API.

Do not bind core application logic to a single model name.

## Jarvis Tools
Expected controlled tools:
- get_today
- get_week
- search_tasks
- create_task
- update_task
- complete_task
- search_projects
- create_project
- update_project
- create_request
- update_request
- mark_request_received
- create_meeting
- add_meeting_note
- search_people
- search_knowledge
- create_knowledge_page
- update_knowledge_page
- get_activity
- generate_briefing
- search_everything

No arbitrary SQL tool.

## Voice Architecture
Separate abstractions:
- SpeechToTextProvider
- TextToSpeechProvider

V1:
- push-to-talk
- speech-to-text
- Jarvis action/reasoning
- optional text-to-speech response

Do not require continuous listening.

## Briefing Engine
Briefings must be fact-first.

Pipeline:
1. query deterministic application facts
2. create structured briefing payload
3. optionally send compact payload to AI for narrative
4. persist both facts and rendered content

This prevents AI-generated fake accomplishments.

## Knowledge Search
V1:
- SQLite full-text search or equivalent

Future:
- semantic embeddings / vector retrieval

Do not require vector infrastructure for initial build.

## GRC Intelligence
External network module.

Pipeline:
- trusted public sources
- retrieval
- deduplication
- relevance scoring
- summary
- why-it-matters analysis
- persisted IntelligenceItem
- dashboard display

Every item must retain its original URL and publication date.

## Local Storage
Primary application data is local.

Target:
- encrypted SQLite database
- encrypted backup archives
- no hosted database in V1

Phase 1 uses a plaintext local SQLite development database so the schema, migrations, persistence, and service boundaries can be proven without choosing an immature encryption design. The connection is centralized in `src/server/db/client.ts`, which is the intended security hook for a later SQLCipher-compatible driver. Production encryption, OS-backed key storage, encrypted backups, restore points, and tested recovery remain Phase 9 work and must be completed before the V1 security acceptance criteria are met. There must be no production plaintext fallback.

## Phase 1 Error Handling and Logging
The Next.js error boundary presents a non-sensitive recovery message. Server logs use structured entries and redact context keys that commonly contain credentials. Callers must still avoid logging record bodies, prompts, notes, database paths, or other sensitive content. No telemetry or remote log transport is configured.

## Backup Architecture
Defaults:
- automatic backups enabled
- due backup runs when app starts and last required backup is overdue
- manual backup available anytime

Retention:
- 14 daily
- 8 weekly
- 12 monthly

Backup contents:
- database
- knowledge
- settings
- attachments if enabled
- manifest
- schema version

Backup encryption:
- encrypt before writing the backup archive

Backup destinations:
- primary local folder
- optional secondary folder chosen by user
- secondary may point to iCloud Drive / OneDrive / Dropbox / external drive without API integration

Restore:
- select backup
- validate manifest
- verify encryption/decryption
- restore safely
- preserve current data via restore point when practical

## Restore Points
Create lightweight restore points before:
- bulk destructive actions
- schema migrations
- major imports
- large Jarvis batch operations where practical

## Import / Export
Support user-owned data export.

Target formats:
- full backup
- JSON
- CSV where appropriate
- Markdown for knowledge pages

## Deployment
V1:
- local web app on localhost

Later:
- desktop packaging if desired

## Cost Awareness
Track locally:
- AI request count
- token usage when available
- speech minutes
- estimated AI cost
- estimated voice cost
- web/news usage

Allow:
- monthly budget
- warning threshold
- optional-service cutoff

Core local features must continue working even if budget limit is reached.
