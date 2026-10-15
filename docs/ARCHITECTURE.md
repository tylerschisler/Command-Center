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
- Drizzle ORM with the `better-sqlite3-multiple-ciphers` encrypted driver, installed through the `better-sqlite3` package alias expected by Drizzle
- ORM purpose: typed, safer application-to-database access and schema migrations

### ORM Decision (Phase 1)
Drizzle was selected over Prisma for the local-first SQLite foundation. It offers strongly typed TypeScript queries while staying close to SQLite and producing reviewable, versioned SQL migrations. Its small runtime surface and lack of a generated database client are a good fit for a single-user local application. The `better-sqlite3` API provides a direct synchronous local connection, which keeps transaction boundaries straightforward for the future requirement that a domain mutation and its `ActivityEvent` commit atomically.

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

Phase 2 adds `TaskService` and `ProjectService` with `TaskRepository` and `ProjectRepository` contracts. Next.js route handlers are thin transport adapters: they validate the HTTP shape, label the source as manual, and call services. Client UI never imports repositories or Drizzle. Repository mutation methods commit the domain row and its immutable `ActivityEvent` in one SQLite transaction, so a partial audit history cannot be produced.

Task and Project inputs are validated with Zod and database CHECK constraints. Calendar dates use `YYYY-MM-DD` strings so target and due dates retain date-only semantics. Target-after-due and overdue states are derived without changing stored dates or Project health. Project progress is deterministic: completed non-archived tasks divided by all non-archived tasks, rounded to a whole percentage; zero tasks is shown as “No tasks” and 0%.

Phase 3 adds `PersonService`/`PersonRepository` and `RequestService`/`RequestRepository` under the same boundary. Person and Request route handlers remain thin manual-source adapters, and each repository mutation writes its domain row and `ActivityEvent` in one SQLite transaction. Person detail and counts are derived through repositories; they are not denormalized. Request overdue, follow-up-needed, due-soon, and waiting-duration states are deterministic service projections.

Task ownership now has three intentional storage states. Mine has no external owner (`ownerId` and `unresolvedOwnerToken` are null). Delegated has an `ownerId` foreign key to a real Person. A migrated Phase 2 anonymous delegation has no Person owner and retains the old opaque UUID in `unresolvedOwnerToken`. Migration `0002` rebuilds `tasks`, copies every old non-null `owner_id` into that token column, and sets the new Person foreign key to null. This avoids data loss, invalid foreign keys, and fabricated contacts. An explicit owner edit validates the Person and clears the unresolved token atomically; `TASK_OWNER_CHANGED` records actual ownership changes.

The People and Waiting On client workspaces call only application route handlers. Project detail embeds the same filtered Waiting On view rather than querying Drizzle. Meetings and richer Notes remain explicit Phase 4+ placeholders.

Phase 4 adds `MeetingService`/`MeetingRepository` and `CalendarService`. Meetings, attendee joins, and decisions are persisted locally; every meaningful Meeting write and its `ActivityEvent` share one SQLite transaction. Meeting creation may also insert initial attendee joins and their events in that transaction. Meeting Mode calls the existing `TaskService` and `RequestService` for action items rather than duplicating their validation or mutation logic.

Tasks and Requests each receive a nullable `meetingId` foreign key with `SET NULL` behavior. This is the smallest durable relationship for action items created from or attached to one Meeting, and avoids introducing the broader generic relationship framework before it is needed. Meeting detail queries those explicit relationships; it never reconstructs them from ActivityEvents.

Meeting timestamps are stored as canonical UTC ISO-8601 instants after local browser input is converted with the platform time-zone rules. They render through the local application time zone, preserving the instant and the expected local display on the originating machine. Task, Project, and Request date-only values remain unchanged.

`CalendarService` is a read-only application projection over Meeting start instants, Task/Project target and due dates, and Request due/follow-up dates. It returns typed events with entity IDs and event kinds for navigation. No duplicate Calendar persistence or direct UI-to-repository path is introduced.

Phase 5 adds `KnowledgeService` and `KnowledgeRepository`. Page, Topic, Tag, version, assignment, archive, restore, and relationship mutations pass through the service and atomically persist their corresponding `ActivityEvent`. A content-changing explicit save also inserts its complete `KnowledgeVersion` in the same transaction. Page creation records the initial version; title-only or summary-only changes do not create redundant content versions.

Knowledge content is stored as portable Markdown text. The client provides an accessible long-form textarea and a safe local renderer without a cloud editor or complex rich-text dependency. The editor uses explicit Save rather than autosave, preventing keystroke-level versions and ActivityEvents.

`EntityRelationship` is introduced as the documented minimal generic cross-entity mechanism. Phase 5 constrains the source to `knowledge_page` and targets to Project, Person, Meeting, or another Knowledge Page. Services validate every target before insertion. Topic and Tag membership remain dedicated many-to-many joins because they are core taxonomy rather than generic semantic relationships.

Local search uses an SQLite FTS5 external-content table over Knowledge title, summary, and content, maintained by database triggers. Topic and Tag names are included with local relational matching. Search stays inside the encrypted SQLite connection and sends no Knowledge content over the network. Semantic/vector search remains deferred.

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

### Phase 6 dashboard and deterministic briefings
`CommandCenterService` builds Home from one bounded `DashboardSnapshot` produced by `DrizzleCommandCenterRepository`. The snapshot uses a fixed set of table queries for Tasks, Projects, Requests, Meetings, People, participants, decisions, and ActivityEvents, avoiding per-row lookups. Current-state sections use current entities; historical EOD and Weekly sections use period-scoped ActivityEvents. `BriefingService` persists both the structured version-1 payload and its deterministic rendering through `BriefingRepository`, which atomically writes `BRIEFING_GENERATED`.

Attention uses documented additive weights: overdue 10,000; target-after-due 5,000; Critical 1,000; High 500; due today/soon 200; blocked or follow-up needed 100. Off Track adds 1,200 and At Risk adds 600. Stable title ordering breaks ties. Focus is the first five ranked attention items and always exposes the factors that produced the recommendation. This is transparent prioritization, not AI inference.

The browser supplies its `YYYY-MM-DD` local date and IANA time-zone name. Date-only Task, Project, and Request fields are compared lexically and never converted to UTC. Meeting UTC instants and ActivityEvent timestamps are converted to calendar dates with `Intl.DateTimeFormat` in the supplied zone. Weekly periods run Monday through Sunday; tomorrow and next-week dates use date-only calendar arithmetic.

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

Phase 1 initially used a plaintext development database to prove the persistence boundaries. Phase 1.5 closes that gap with encrypted production storage and no plaintext fallback in the normal application connection path.

### Phase 1.5 encryption decision
Phase 1.5 replaces the stock `better-sqlite3` binary with the API-compatible `better-sqlite3-multiple-ciphers` build while retaining Drizzle, the synchronous repository contract, schemas, and migrations. The driver bundles SQLite3 Multiple Ciphers and is configured explicitly for its non-legacy sqleet scheme: ChaCha20 encryption with per-page Poly1305 authentication. Temporary SQLite storage is forced to memory because the currently bundled SQLite3 Multiple Ciphers version does not yet provide the newer encrypted temporary-file behavior.

The application applies the cipher and 256-bit key before any schema access, then forces an immediate schema read so a wrong key fails during connection creation. Plaintext SQLite headers are rejected by the normal connection path; `npm run db:encrypt` is the explicit, recoverable conversion path for an earlier Phase 1 database. The conversion checks integrity, works on a copy, verifies the encrypted result, and preserves an encrypted pre-conversion copy without leaving a plaintext fallback.

The master key is generated using Node's cryptographically secure random generator and stored as a generic secret in macOS Keychain through native Security-framework bindings supplied by `@napi-rs/keyring`. It is never written to environment files, database directories, backup files, logs, or Git. Production currently fails closed on platforms without macOS Keychain. Test-only deterministic key injection is available outside production through the `DatabaseKeyProvider` interface.

### Phase 1.6 portable recovery
Keychain remains the primary runtime key store. Recovery initialization generates an independent random 256-bit credential, displays it once, and uses scrypt (`N=131072`, `r=8`, `p=1`, random 256-bit salt) to derive a wrapping key. AES-256-GCM then wraps the existing database master key with authenticated versioned metadata. Only that protected envelope is stored at `RECOVERY_MATERIAL_PATH`; the credential is never persisted by the application. The envelope cannot open the database without the credential, and the credential is useless without an envelope copied with the application data or embedded in a recovery-enabled backup.

`RecoveryService` owns initialization, verification, Keychain reconstruction, backup-assisted Keychain reconstruction, and credential rotation. Every candidate recovered key must successfully open and integrity-check the encrypted database, or authenticate and validate an entire `CCBACKUP1` archive, before it is written to Keychain. Recovery never decrypts SQLite into a plaintext file.

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

Phase 1.5 manual backups use the versioned `CCBACKUP1` binary envelope. Before capture, SQLite integrity is checked and WAL contents are checkpointed into the encrypted main database. The encrypted database bytes are read directly; a backup-specific 256-bit key is derived from the Keychain-held master key with HKDF-SHA-256 and a random salt, then the database image is encrypted again with AES-256-GCM. Non-secret metadata—including format version, ciphers, creation time, schema migration count, sizes, salt, nonce, and SHA-256—is authenticated as additional data. Phase 1.6 recovery-enabled backups also embed the independently AES-GCM-protected recovery envelope, never the recovery credential. Existing `CCBACKUP1` archives without that optional field remain valid but cannot bootstrap a lost Keychain. No plaintext database snapshot is written during backup creation.

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

Phase 1.5 restore validates the envelope authentication tag, database hash, encryption key, and SQLite integrity before replacement. It closes the application connection, checkpoints the current database, and renames the current encrypted file to a unique `pre-restore` copy before moving the validated restore into place. A failed final integrity check rolls the protected database back. The CLI requires an explicit `--confirm` argument.

Pre-conversion copies are created only by an explicit plaintext conversion, after the source itself has been encrypted and the replacement has passed integrity validation. Pre-restore copies are created only after a backup has been authenticated and integrity-checked. They may be deleted after the active database has been reopened and verified and a separate backup is known good. Phase 1.6 automatically retains at most the three newest copies of each type after a successful operation; it never prunes the rollback copy before success. Phase 9 adds startup-driven scheduling, tiered backup retention, secondary destinations, and backup-management UI on top of that protected-copy policy.

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

## Phase 7 Jarvis Implementation

Phase 7 introduces a provider-neutral `AiProvider` boundary with an OpenAI Responses API implementation. The server performs a bounded tool loop (six rounds and twelve calls), uses strict function schemas, disables provider-side response storage, applies timeouts/retries, and validates the final structured workspace response with Zod. The browser never receives the API key and never calls the provider directly.

`JarvisToolController` is the sole AI action boundary. Its explicit registry exposes narrowly scoped read and low-risk write tools; every tool validates arguments and calls an application service. There is no generic SQL, repository, filesystem, shell, backup, secret, arbitrary URL, archive, delete, or bulk-mutation tool. Unknown and significant actions fail closed. Mutation summaries are rebuilt from actual successful tool results, and entity references/navigation are retained only when grounded in retrieved or mutated IDs.

The UI is a command surface and document-style Workspace, not a transcript. Provider output is a typed block schema rendered as React text and local entity links; raw HTML/Markdown and model-authored URLs are not rendered. Project and Knowledge detail views publish only explicit page context. Follow-up subject state exists only in browser memory.

AI settings and aggregate usage are local encrypted records. Prompts and responses are not persisted. Deterministic Phase 6 facts remain authoritative for briefing generation; Phase 7 may present those facts but does not replace or rewrite them with model claims.

## Phase 8 Voice Jarvis

Phase 8 adds provider-neutral `SpeechToTextProvider` and `TextToSpeechProvider` boundaries. OpenAI implementations use the server-only Audio transcription and speech APIs; the configured model names come from `OPENAI_STT_MODEL` and `OPENAI_TTS_MODEL`, and the browser never receives the API key. The initial recommended low-cost configuration is `gpt-4o-mini-transcribe` for command transcription and `gpt-4o-mini-tts` for short spoken summaries, but application services do not depend on those identifiers.

The flow remains push-to-talk → speech-to-text → the existing `JarvisService` and strict tool controller → structured visual result → optional text-to-speech. It does not use the Realtime API or keep a paid audio session open. Voice-originated mutations pass `source: voice` through the same application services and transactional ActivityEvent paths as typed Jarvis mutations.

Browser audio capture begins only from the focused microphone button's pointer or keyboard press and stops on release or after 30 seconds. The local `/api/voice/command` route accepts only one supported audio file plus bounded command metadata, rejects recordings over 5 MB or 30 seconds, and keeps bytes in memory. It never writes temporary audio, SQLite audio, transcripts, or conversation history. The server returns the ephemeral transcript for visual confirmation and discards request audio after processing.

TTS is a non-authoritative presentation step. `VoiceService` first completes Jarvis and commits any service mutation, then decides whether a short summary should be spoken. Confirmation, briefing, and long-response settings are enforced before synthesis. TTS/provider/playback failure leaves the structured visual result and completed action intact. Long Workspace output is never read in full automatically; Ask mode offers a separate Speak summary action.

Meeting Mode publishes an explicit Meeting page context to the existing Jarvis surface. Meeting notes, decisions, Tasks, and Requests still use the allowlisted tools and existing Meeting, Task, and Request services. There is no continuous meeting capture, diarization, or full-meeting transcription.

Encrypted `voice_usage_records` contain only operation kind, provider/model, timestamp, duration, character count, byte count, and an estimated-cost field. Pricing is versioned outside the service layer. The local settings table includes voice/STT/TTS switches, spoken-output policy, an automatic character limit, optional warning thresholds, and an opt-in hard cutoff for nonessential AI usage.

## Phase 9 V1 Completion Architecture

### Intelligence

`PublicFeedIntelligenceProvider` retrieves only configured public RSS/Atom endpoints. The reviewed defaults are CISA, NIST, and SEC; `INTELLIGENCE_SOURCES_JSON` may replace them with a bounded, validated list. Feed failures are isolated per source. URLs are restricted to public HTTP(S), tracking fragments are removed for deduplication, and source HTML is converted to bounded plain text. Retrieved instructions remain inert data and are never sent to the Jarvis tool loop.

`IntelligenceService` classifies topics and ranks items with explainable inputs: authority (0–25), freshness (0–25), topic matches (0–30), financial/third-party relevance (0–15), and significant-event terms (0–5). It persists through `IntelligenceRepository`, deduplicates by canonical URL and normalized headline/publication day, and records one aggregate refresh event. Save to Knowledge calls `KnowledgeService`, stores summary/metadata/user notes rather than article text, and preserves normal KnowledgeVersion and ActivityEvent behavior. Home and Morning Briefing consume only persisted high-relevance items.

### Backup scheduling and retention

`BackupManagerService` wraps the unchanged authenticated `CCBACKUP1` cryptography. A non-blocking browser startup check asks the local server whether a validated backup is at least 24 hours old; if so, one is created and validated. Manual Backup Now follows the same path. Migration CLI runs create a validated encrypted restore point before modifying an existing database.

Retention processes successful managed archives newest-first: retain the newest backup for 14 distinct days, then the newest for 8 additional ISO weeks, then the newest for 12 additional months. The newest known-good backup is always retained. Failed and failed-validation records are never retention deletion candidates. Deletion requires both a managed filename and containment inside the configured primary/secondary root. Stale managed `.tmp` files older than 24 hours are removed; encrypted pre-restore/pre-encryption copies remain bounded to three by the existing protected-copy policy.

Optional secondary folders receive the already encrypted archive by temporary copy plus atomic rename. Primary success is recorded as `partial` if secondary copying fails. Restore requires selecting a managed record, revalidation, typing `RESTORE`, protected-current-state replacement, post-activation verification, automatic rollback on failure, and `BACKUP_RESTORED` activity.

### Cost controls and model-routing hook

Pricing is isolated in `src/config/pricing.ts` with a version and per-model text, transcription, or speech units. Standard `gpt-5.6-terra` pricing is $2.00 input, $0.20 cached input, and $12.00 output per million tokens. Responses API cached-input counts are applied to the estimate when present; usage records store the resulting estimate at request time without adding prompt content or a schema field. Unknown models remain null and render as Unknown rather than zero. Monthly warnings are informational; the optional hard cutoff gates Jarvis, STT, and TTS before provider calls while local application services and deterministic briefings remain available. `OPENAI_SIMPLE_MODEL` is a documented routing target, but V1 does not silently switch models.

### Network boundaries

Only OpenAI Jarvis, OpenAI STT/TTS, and configured Intelligence feeds access the network. Task, Project, Request, Meeting, People, Knowledge, FTS5, Calendar, deterministic Briefing, encryption, and local/secondary-folder backup workflows remain offline-capable. No telemetry or analytics transport exists.

## V1.1 reliability and deletion boundaries

Primary navigation is defined once in `src/config/navigation.ts`; the client navigation component computes exact-root and section-prefix active state with `usePathname`. Home remains the normal `/` App Router page. The observed Home failure was not a redirect or route-table defect: Playwright reused an orphan development server whose isolated database had already been removed. E2E now always starts its guarded temporary-database server, and navigation tests cover direct load, refresh, every section-to-Home path, active state, and keyboard activation.

`/api/ai/settings` continues to return the server-owned complete settings contract. The Jarvis client additionally normalizes unknown, legacy, or partial responses into a complete fail-safe voice object while preserving a valid `cloudAiEnabled` value. Fetch failures disable voice presentation only; typed Jarvis remains independent. This fixes the regression where a truthy error/partial object could be stored as settings and `settings.voice.enabled` then threw.

Permanent deletion is an explicit service operation requiring the literal `DELETE` confirmation. Repositories combine domain deletion, relationship handling, and a content-minimized deletion ActivityEvent in one transaction. Project deletion preserves Tasks, Requests, and Meetings while clearing `projectId`, and removes Knowledge relationships targeting the Project. Person deletion is blocked while any active, completed, or archived Task or Request assignment exists. Meeting deletion preserves linked Tasks/Requests through `SET NULL`; attendee/decision rows are removed. Knowledge deletion removes incoming/outgoing entity relationships and relies on transactional foreign-key cascades plus existing FTS triggers for versions, taxonomy links, and search entries. No deletion API is exposed to Jarvis.
