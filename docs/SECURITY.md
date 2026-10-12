# Security Architecture — V1

## Security Goals
- local-first storage
- encrypted local database
- encrypted backups
- controlled cloud AI usage
- least-privilege Jarvis tools
- no hard-coded secrets
- no silent telemetry
- reliable recovery
- auditability of meaningful changes

## Threat Model
Primary risks:
- lost/stolen laptop
- accidental deletion
- database corruption
- over-permissioned AI actions
- cloud leakage through excessive context
- exposed API keys
- malicious/incorrect generated code
- backup failure
- unsafe destructive operations

## Local Database Encryption
The active SQLite database should be encrypted using a mature, maintainable mechanism compatible with the chosen runtime.

Requirements:
- encryption at rest
- no plaintext fallback in production
- key must not be committed to source control
- document key storage and recovery strategy

Implementation choice should be documented before production use.

### Phase 1 status
Encryption at rest is deliberately deferred to the Phase 9 hardening work identified in the roadmap. Phase 1 stores the development database locally, ignores database and backup artifacts in Git, and centralizes creation of the SQLite connection so a vetted SQLCipher-compatible driver can replace it without bypassing repositories or services. Before production use, select and document the encryption library, use OS-backed secure key storage, define recovery behavior, remove any plaintext fallback, and add encryption/restore verification tests.

## Backup Encryption
All backups must be encrypted before being written to their destination.

Requirements:
- authenticated encryption
- versioned backup manifest
- schema version
- restore verification
- clear recovery process

## Secret Management
Never commit:
- OpenAI API key
- speech API keys
- news API keys
- encryption keys
- backup passphrases

Use:
- environment variables during development
- secure local secret storage for normal use when feasible

Provide `.env.example` without real secrets.

## Cloud AI
Cloud AI is allowed for V1.

Rules:
- only minimum necessary context is sent
- entire database is never sent by default
- user can disable cloud AI
- cloud AI should not be required for core CRUD functionality
- no sensitive data should be sent unless allowed by user configuration
- log enough metadata to understand AI usage, but do not create unnecessary sensitive logs

## Jarvis Permissions
Jarvis uses an explicit tool allowlist.

Read actions:
- generally allowed without confirmation

Low-risk writes:
- may execute with visible confirmation and undo where practical

High-impact/destructive actions:
- require explicit confirmation

Examples requiring confirmation:
- delete project
- delete many tasks
- bulk completion
- archive many records
- destructive restore
- large knowledge overwrite

Jarvis must not:
- execute arbitrary SQL
- run shell commands from natural-language user input
- read filesystem locations outside approved application paths
- modify source code at runtime
- access secrets directly unless required by provider code

## Activity Audit Trail
Meaningful application actions must create ActivityEvents.

Activity records should support:
- what happened
- what entity changed
- when
- source (manual, jarvis, voice, import, system)
- useful metadata

## Undo / Recovery
Provide undo or recovery for:
- low-risk Jarvis mutations
- batch actions where feasible
- accidental edits through version history
- knowledge changes through KnowledgeVersion
- major operations through restore points

## Backup Policy
Default:
- daily backups
- retain 14 daily
- retain 8 weekly
- retain 12 monthly

Backup should run when:
- app starts and required backup is overdue
- user manually requests backup
- before defined high-risk operations when practical

## Restore Testing
Automated test must:
1. create known data
2. back it up
3. remove/corrupt test database
4. restore backup
5. verify recovered data
6. fail loudly if verification differs

## Dependencies
- prefer widely used, maintained dependencies
- avoid unnecessary packages
- pin versions appropriately
- run dependency vulnerability checks before release checkpoints
- document security-sensitive libraries

## Logging
Do not log:
- API secrets
- encryption keys
- raw authentication material

Be careful logging:
- full AI prompts
- full knowledge pages
- full notes
- backup paths

## Network Boundaries
Internet use is expected for:
- cloud AI
- speech services
- GRC intelligence

No internet should be required for:
- viewing/editing local data
- tasks
- projects
- requests
- meetings
- people
- knowledge
- local search
- backup/restore to local destination

## Security Acceptance Criteria for V1
- encrypted database
- encrypted backups
- no secrets committed
- Jarvis tool allowlist
- destructive confirmations
- activity logging
- tested restore
- local-only primary persistence
- cloud AI can be disabled
