# Implementation Roadmap

## Phase 0 — Repository + Guardrails
Build:
- repository structure
- AGENTS.md
- docs
- README
- Git setup
- base configuration

Definition of Done:
- source-of-truth documents exist
- Git repository initialized
- environment examples created
- Codex rules documented

## Phase 1 — Application Foundation
Build:
- Next.js / React / TypeScript
- SQLite
- ORM
- migrations
- app shell
- navigation
- design-system foundation
- environment configuration
- error handling
- service pattern
- ActivityEvent foundation
- test framework

Definition of Done:
- app launches locally
- navigation works
- database initializes
- persisted test record survives restart
- migration workflow works
- test/type/lint commands work

## Phase 1.5 — Local Data Protection
Build:
- encrypted local database storage
- macOS Keychain-backed master key
- explicit plaintext-to-encrypted conversion
- manual authenticated encrypted backup
- backup validation
- protected restore

Definition of Done:
- database cannot be queried without the valid key
- key is not stored with application data or in Git
- backup authentication and database integrity are verified
- known records survive a complete backup/restore test
- the active database is preserved before restore
- automatic scheduling, retention, secondary destinations, management UI, and disaster-recovery hardening remain deferred to Phase 9

## Phase 1.6 — Portable Recovery Credential
Build:
- high-entropy offline recovery credential
- authenticated wrapping of the database master key
- Keychain-loss verification and reconstruction
- recovery material embedded in new `CCBACKUP1` backups
- bounded encrypted pre-conversion and pre-restore copy lifecycle

Definition of Done:
- normal access still uses macOS Keychain
- loss of the Keychain entry blocks normal access
- the correct credential reconstructs Keychain only after database or backup validation
- an incorrect credential fails closed
- a recovery-enabled backup can move the data to a new Mac
- no plaintext database or persisted plaintext credential is created

## Phase 2 — Tasks + Projects
Build:
- Task CRUD
- Project CRUD
- ownership
- status
- priority
- start / target / due / completion dates
- project task relationships
- progress calculation
- activity history

Definition of Done:
- user can manage real work in app
- target-after-due risk surfaces
- every meaningful mutation creates ActivityEvent

Implemented foundation:
- encrypted migrations for `projects` and `tasks`
- service-only CRUD, completion, archive, and restore operations
- atomic ActivityEvents for meaningful mutations
- My Work filters and fast task editor
- Project list, overview, tasks, activity, progress, and deterministic risk states
- temporary Mine/Delegated ownership convention pending Phase 3 People

## Phase 3 — People + Waiting On
Build:
- Person CRUD
- Request CRUD
- waiting dashboard
- follow-up dates
- person detail with tasks/requests/projects/meetings/notes

Definition of Done:
- user can answer "who owes me something?"
- request lifecycle works
- follow-up needed and overdue filters work

Implemented foundation:
- encrypted versioned migration for `people`, `requests`, and safe legacy Task ownership conversion
- Person CRUD/archive/restore with derived Task, Request, and Project relationships
- Request CRUD, lifecycle dates, archive/restore, and atomic ActivityEvents
- real Person ownership in My Work with an explicit unresolved-legacy repair state
- People and Waiting On workspaces with deterministic overdue, due-soon, and follow-up views
- functional Project Waiting On tab and Phase 4 Meetings placeholder

## Phase 4 — Calendar + Meetings
Build:
- Day / Week / Month / Agenda views
- meeting CRUD
- attendees
- meeting notes
- related project
- quick task/request from meeting
- Meeting Mode

Definition of Done:
- calendar renders all defined time-based entities
- meeting notes and action items work without AI

Implemented foundation:
- encrypted versioned migration for Meetings, attendees, decisions, and durable action-item relationships
- Meeting CRUD/lifecycle with atomic ActivityEvents, Project association, attendees, notes, and decisions
- focused manual Meeting Mode with quick Tasks and Requests through existing services
- Month, Week, Day, and Agenda projections without duplicate Calendar storage
- functional Person and Project Meeting sections
- UTC instant storage for Meetings while preserving existing date-only semantics

## Phase 5 — Knowledge Library
Build:
- KnowledgePage CRUD
- Topics
- Tags
- multiple-topic membership
- version history
- relations
- full-text search

Definition of Done:
- user can manually manage reusable knowledge
- one page can appear under multiple topics
- all edits preserve version history

Implemented foundation:
- encrypted versioned migration for Knowledge Pages, Topics, Tags, versions, taxonomy joins, generic entity relationships, and local FTS5
- manual Markdown create/edit/archive/restore with explicit-save version history and restore-to-version
- multi-topic and multi-tag browsing with normalized duplicate prevention
- local title/content/summary/Topic/Tag search
- relationships to Projects, People, Meetings, and other Knowledge Pages with lightweight existing-screen integrations
- atomic ActivityEvents for meaningful Knowledge mutations

## Phase 6 — Command Center + Briefings
Build:
- Home dashboard
- Today
- Attention Needed
- Waiting On
- Meetings
- Project Health
- deterministic briefing engine
- Briefing Library

Definition of Done:
- Morning, EOD, Weekly fact payloads can be generated without AI
- briefings persist
- dashboard surfaces risk and focus

Implemented foundation:
- encrypted versioned `briefings` migration with structured facts, deterministic rendering, and atomic `BRIEFING_GENERATED` events
- bounded aggregate Home projection across Tasks, Projects, Requests, Meetings, People, decisions, and ActivityEvents
- actionable summary, Today’s Work, Attention, Waiting On, Meetings, Project Health, and transparent Focus ranking
- manual Morning, End-of-Day, and Weekly generation with a persisted library and immutable regeneration snapshots
- browser-local date and IANA time-zone boundaries while retaining date-only domain semantics

## Phase 7 — Jarvis Text + Workspace

Status: implemented in the `v0.7-jarvis` candidate; verification remains required before checkpointing.
Build:
- AI provider abstraction
- OpenAI provider
- Jarvis tool controller
- explicit tool allowlist
- integrated command input
- contextual Jarvis actions
- Jarvis Workspace
- action summaries
- confirmation/undo patterns
- AI usage tracking

Definition of Done:
- natural language can operate most core workflows
- no direct database access from Jarvis
- substantial outputs render in Workspace
- destructive actions require confirmation

## Phase 8 — Voice Jarvis
Status: implemented in the `v0.8-voice` candidate; final browser verification remains required before checkpointing.
Build:
- SpeechToText provider abstraction
- TextToSpeech provider abstraction
- OpenAI-compatible provider(s)
- push-to-talk
- audible responses
- voice settings
- Meeting Mode voice capture

Definition of Done:
- user can issue commands by voice
- Jarvis can speak back
- voice can create meeting notes/tasks/requests through controlled tools

Implemented foundation:
- server-only provider abstractions with OpenAI and deterministic test adapters
- short, explicit push-to-talk capture with size/duration/content-type limits and no audio persistence
- existing Jarvis/service/tool pipeline reused with `voice` ActivityEvent provenance
- short spoken summaries with independent confirmation, briefing, and long-response policy
- Meeting Mode voice context for notes, decisions, Tasks, and Requests
- encrypted preference and metadata-only voice usage tracking with an optional monthly duration warning

## Phase 9 — GRC Intelligence + Backup + Hardening
Build:
- Intelligence retrieval
- source persistence
- relevance scoring
- save-to-knowledge
- automatic encrypted backup
- retention
- restore
- restore tests
- restore points
- optional secondary folder
- cost controls
- dependency/security checks
- hardening

Definition of Done:
- morning briefing can include relevant public GRC stories
- backups occur automatically
- restore is tested
- encrypted local storage is production-ready
- V1 security checklist passes

## Planned Git Checkpoints
- v0.1-foundation
- v0.2-tasks-projects
- v0.3-requests-people
- v0.4-calendar-meetings
- v0.5-knowledge
- v0.6-dashboard-briefings
- v0.7-jarvis
- v0.8-voice
- v1.0

## Out of Scope for V1
- enterprise multi-user support
- work email integration
- work calendar integration
- automatic full-meeting recording/transcription
- mobile client
- hosted primary database
- full GRC controls platform
