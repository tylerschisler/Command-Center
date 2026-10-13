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

Phase 2 ownership is transitional: null `ownerId` means the current user and non-null means delegated. No People table or foreign key is introduced before Phase 3. The UI creates an opaque UUID for anonymous delegation so the stored shape remains compatible with later Person UUIDs without inventing a Person record.

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

Pre-conversion copies are created only by an explicit plaintext conversion, after the source itself has been encrypted and the replacement has passed integrity validation. Pre-restore copies are created only after a backup has been authenticated and integrity-checked. They may be deleted after the active database has been reopened and verified and a separate backup is known good. Phase 1.6 automatically retains at most the three newest copies of each type after a successful operation; it never prunes the rollback copy before success. Scheduling, tiered backup retention, secondary destinations, backup-management UI, and the complete disaster-recovery workflow remain Phase 9 work.

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
